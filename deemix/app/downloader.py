#!/usr/bin/env python3
import os.path
import re
import traceback
from concurrent.futures import ThreadPoolExecutor
from os import makedirs, remove, system as execute
from tempfile import gettempdir
from time import sleep

from Cryptodome.Cipher import Blowfish
from requests import get
from requests.exceptions import HTTPError, ConnectionError

from deemix.api.deezer import APIError, USER_AGENT_HEADER
from deemix.utils.misc import changeCase
from deemix.utils.pathtemplates import generateFilename, generateFilepath, settingsRegexAlbum, settingsRegexArtist
from deemix.utils.taggers import tagID3, tagFLAC

TEMPDIR = os.path.join(gettempdir(), 'deemix-imgs')
if not os.path.isdir(TEMPDIR):
    makedirs(TEMPDIR)

extensions = {
    9: '.flac',
    3: '.mp3',
    1: '.mp3',
    8: '.mp3',
    15: '.mp4',
    14: '.mp4',
    13: '.mp4'
}
downloadPercentage = 0
lastPercentage = 0


def stream_track(dz, track, stream, trackAPI, queueItem, interface=None):
    global downloadPercentage, lastPercentage
    if 'cancel' in queueItem:
        raise downloadCancelled
    try:
        request = get(track['downloadUrl'], headers=dz.http_headers, stream=True, timeout=30)
    except ConnectionError:
        sleep(2)
        return stream_track(dz, track, stream, trackAPI, queueItem, interface)
    request.raise_for_status()
    blowfish_key = str.encode(dz._get_blowfish_key(str(track['id'])))
    complete = int(request.headers["Content-Length"])
    chunkLength = 0
    percentage = 0
    i = 0
    for chunk in request.iter_content(2048):
        if 'cancel' in queueItem:
            raise downloadCancelled
        if (i % 3) == 0 and len(chunk) == 2048:
            chunk = Blowfish.new(blowfish_key, Blowfish.MODE_CBC, b"\x00\x01\x02\x03\x04\x05\x06\x07").decrypt(chunk)
        stream.write(chunk)
        chunkLength += len(chunk)
        if 'SINGLE_TRACK' in trackAPI:
            percentage = (chunkLength / complete) * 100
            downloadPercentage = percentage
        else:
            chunkProgres = (len(chunk) / complete) / trackAPI['SIZE'] * 100
            downloadPercentage += chunkProgres
        if round(downloadPercentage) != lastPercentage and round(percentage) % 5 == 0:
            lastPercentage = round(downloadPercentage)
            if interface:
                queueItem['progress'] = lastPercentage
                interface.send("updateQueue", {'uuid': queueItem['uuid'], 'progress': lastPercentage})
        i += 1


def downloadImage(url, path):
    if not os.path.isfile(path):
        try:
            image = get(url, headers={'User-Agent': USER_AGENT_HEADER}, timeout=30)
            with open(path, 'wb') as f:
                f.write(image.content)
                return path
        except ConnectionError:
            sleep(1)
            return downloadImage(url, path)
        except HTTPError:
            print("Couldn't download Image")
        remove(path)
        return None
    else:
        return path


def formatDate(date, template):
    elements = {
        'year': ['YYYY', 'YY', 'Y'],
        'month': ['MM', 'M'],
        'day': ['DD', 'D']
    }
    for element, placeholders in elements.items():
        for placeholder in placeholders:
            if placeholder in template:
                template = template.replace(placeholder, str(date[element]))
    return template


def getPreferredBitrate(dz, track, bitrate, fallback=True):
    if not fallback:
        formats = {9: 'flac', 3: 'mp3_320', 1: 'mp3_128', 15: '360_hq', 14: '360_mq', 13: '360_lq'}
        request = get(dz.get_track_stream_url(track['id'], track['MD5'], track['mediaVersion'], bitrate))
        try:
            request.raise_for_status()
        except HTTPError:
            return -100
        return int(bitrate)
    if int(bitrate) in [13, 14, 15]:
        formats = {'360_hq': 15, '360_mq': 14, '360_lq': 13}
        selectedFormat = -200
        for format, formatNum in formats.items():
            if formatNum <= int(bitrate):
                request = get(dz.get_track_stream_url(track['id'], track['MD5'], track['mediaVersion'], formatNum))
                try:
                    request.raise_for_status()
                except HTTPError:
                    continue
                selectedFormat = formatNum
                break
    else:
        formats = {'flac': 9, 'mp3_320': 3, 'mp3_128': 1}
        selectedFormat = 8
        for format, formatNum in formats.items():
            if formatNum <= int(bitrate):
                request = get(dz.get_track_stream_url(track['id'], track['MD5'], track['mediaVersion'], formatNum))
                try:
                    request.raise_for_status()
                except HTTPError:
                    continue
                selectedFormat = formatNum
                break
    return selectedFormat


def parseEssentialTrackData(track, trackAPI):
    track['id'] = trackAPI['SNG_ID']
    track['duration'] = trackAPI['DURATION']
    track['MD5'] = trackAPI['MD5_ORIGIN']
    track['mediaVersion'] = trackAPI['MEDIA_VERSION']
    if 'FALLBACK' in trackAPI:
        track['fallbackId'] = trackAPI['FALLBACK']['SNG_ID']
    else:
        track['fallbackId'] = 0

    return track


def getTrackData(dz, trackAPI_gw, trackAPI=None, albumAPI_gw=None, albumAPI=None):
    if not 'MD5_ORIGIN' in trackAPI_gw:
        trackAPI_gw['MD5_ORIGIN'] = dz.get_track_md5(trackAPI_gw['SNG_ID'])

    track = {}
    track['title'] = trackAPI_gw['SNG_TITLE'].strip()
    if 'VERSION' in trackAPI_gw and trackAPI_gw['VERSION'] and not trackAPI_gw['VERSION'] in trackAPI_gw['SNG_TITLE']:
        track['title'] += " " + trackAPI_gw['VERSION'].strip()

    track = parseEssentialTrackData(track, trackAPI_gw)

    if int(track['id']) < 0:
        track['album'] = {}
        track['album']['id'] = 0
        track['album']['title'] = trackAPI_gw['ALB_TITLE']
        if 'ALB_PICTURE' in trackAPI_gw:
            track['album']['pic'] = trackAPI_gw['ALB_PICTURE']
        track['mainArtist'] = {}
        track['mainArtist']['id'] = 0
        track['mainArtist']['name'] = trackAPI_gw['ART_NAME']
        track['artists'] = [trackAPI_gw['ART_NAME']]
        track['aritst'] = {
            'Main': [trackAPI_gw['ART_NAME']]
        }
        track['date'] = {
            'day': 0,
            'month': 0,
            'year': 0
        }
        track['localTrack'] = True
        return track

    if 'DISK_NUMBER' in trackAPI_gw:
        track['discNumber'] = trackAPI_gw['DISK_NUMBER']
    if 'EXPLICIT_LYRICS' in trackAPI_gw:
        track['explicit'] = trackAPI_gw['EXPLICIT_LYRICS'] != "0"
    if 'COPYRIGHT' in trackAPI_gw:
        track['copyright'] = trackAPI_gw['COPYRIGHT']
    track['replayGain'] = "{0:.2f} dB".format(
        (float(trackAPI_gw['GAIN']) + 18.4) * -1) if 'GAIN' in trackAPI_gw else None
    track['ISRC'] = trackAPI_gw['ISRC']
    track['trackNumber'] = trackAPI_gw['TRACK_NUMBER']
    track['contributors'] = trackAPI_gw['SNG_CONTRIBUTORS']
    if 'POSITION' in trackAPI_gw:
        track['position'] = trackAPI_gw['POSITION']

    track['lyrics'] = {}
    if 'LYRICS_ID' in trackAPI_gw:
        track['lyrics']['id'] = trackAPI_gw['LYRICS_ID']
    if not "LYRICS" in trackAPI_gw and int(track['lyrics']['id']) != 0:
        trackAPI_gw["LYRICS"] = dz.get_lyrics_gw(track['id'])
    if int(track['lyrics']['id']) != 0:
        if "LYRICS_TEXT" in trackAPI_gw["LYRICS"]:
            track['lyrics']['unsync'] = trackAPI_gw["LYRICS"]["LYRICS_TEXT"]
        if "LYRICS_SYNC_JSON" in trackAPI_gw["LYRICS"]:
            track['lyrics']['sync'] = ""
            lastTimestamp = ""
            for i in range(len(trackAPI_gw["LYRICS"]["LYRICS_SYNC_JSON"])):
                if "lrc_timestamp" in trackAPI_gw["LYRICS"]["LYRICS_SYNC_JSON"][i]:
                    track['lyrics']['sync'] += trackAPI_gw["LYRICS"]["LYRICS_SYNC_JSON"][i]["lrc_timestamp"]
                    lastTimestamp = trackAPI_gw["LYRICS"]["LYRICS_SYNC_JSON"][i]["lrc_timestamp"]
                else:
                    track['lyrics']['sync'] += lastTimestamp
                track['lyrics']['sync'] += trackAPI_gw["LYRICS"]["LYRICS_SYNC_JSON"][i]["line"] + "\r\n"

    track['mainArtist'] = {}
    track['mainArtist']['id'] = trackAPI_gw['ART_ID']
    track['mainArtist']['name'] = trackAPI_gw['ART_NAME']
    if 'ART_PICTURE' in trackAPI_gw:
        track['mainArtist']['pic'] = trackAPI_gw['ART_PICTURE']

    if 'PHYSICAL_RELEASE_DATE' in trackAPI_gw:
        track['date'] = {
            'day': trackAPI_gw["PHYSICAL_RELEASE_DATE"][8:10],
            'month': trackAPI_gw["PHYSICAL_RELEASE_DATE"][5:7],
            'year': trackAPI_gw["PHYSICAL_RELEASE_DATE"][0:4]
        }

    track['album'] = {}
    track['album']['id'] = trackAPI_gw['ALB_ID']
    track['album']['title'] = trackAPI_gw['ALB_TITLE']
    if 'ALB_PICTURE' in trackAPI_gw:
        track['album']['pic'] = trackAPI_gw['ALB_PICTURE']

    try:
        if not albumAPI:
            albumAPI = dz.get_album(track['album']['id'])
        track['album']['mainArtist'] = {
            'id': albumAPI['artist']['id'],
            'name': albumAPI['artist']['name'],
            'pic': albumAPI['artist']['picture_small'][albumAPI['artist']['picture_small'].find('artist/') + 7:-24]
        }
        track['album']['artist'] = {}
        track['album']['artists'] = []
        for artist in albumAPI['contributors']:
            if artist['id'] != 5080:
                track['album']['artists'].append(artist['name'])
                if not artist['role'] in track['album']['artist']:
                    track['album']['artist'][artist['role']] = []
                track['album']['artist'][artist['role']].append(artist['name'])
        track['album']['trackTotal'] = albumAPI['nb_tracks']
        track['album']['recordType'] = albumAPI['record_type']
        track['album']['barcode'] = albumAPI['upc'] if 'upc' in albumAPI else "Unknown"
        track['album']['label'] = albumAPI['label'] if 'label' in albumAPI else "Unknown"
        if not 'pic' in track['album']:
            track['album']['pic'] = albumAPI['cover_small'][albumAPI['cover_small'].find('cover/') + 6:-24]
        if 'release_date' in albumAPI:
            track['album']['date'] = {
                'day': albumAPI["release_date"][8:10],
                'month': albumAPI["release_date"][5:7],
                'year': albumAPI["release_date"][0:4]
            }
        track['album']['discTotal'] = albumAPI['nb_disk'] if 'nb_disk' in albumAPI else None
        track['copyright'] = albumAPI['copyright'] if 'copyright' in albumAPI else None
        track['album']['genre'] = []
        if 'genres' in albumAPI and 'data' in albumAPI['genres'] and len(albumAPI['genres']['data']) > 0:
            for genre in albumAPI['genres']['data']:
                track['album']['genre'].append(genre['name'])
    except APIError:
        if not albumAPI_gw:
            albumAPI_gw = dz.get_album_gw(track['album']['id'])
        track['album']['mainArtist'] = {
            'id': albumAPI_gw['ART_ID'],
            'name': albumAPI_gw['ART_NAME']
        }
        artistAPI = dz.get_artist(track['album']['mainArtist']['id'])
        track['album']['artists'] = albumAPI_gw['ART_NAME']
        track['album']['mainArtist']['pic'] = artistAPI['picture_small'][
                                              artistAPI['picture_small'].find('artist/') + 7:-24]
        track['album']['trackTotal'] = albumAPI_gw['NUMBER_TRACK']
        track['album']['discTotal'] = albumAPI_gw['NUMBER_DISK']
        track['album']['recordType'] = "Album"
        track['album']['barcode'] = "Unknown"
        track['album']['label'] = albumAPI_gw['LABEL_NAME'] if 'LABEL_NAME' in albumAPI_gw else "Unknown"
        if not 'pic' in track['album']:
            track['album']['pic'] = albumAPI_gw['ALB_PICTURE']
        if 'PHYSICAL_RELEASE_DATE' in albumAPI_gw:
            track['album']['date'] = {
                'day': albumAPI_gw["PHYSICAL_RELEASE_DATE"][8:10],
                'month': albumAPI_gw["PHYSICAL_RELEASE_DATE"][5:7],
                'year': albumAPI_gw["PHYSICAL_RELEASE_DATE"][0:4]
            }
        track['album']['genre'] = []

    if 'date' in track['album'] and 'date' not in track:
        track['date'] = track['album']['date']

    if not trackAPI:
        trackAPI = dz.get_track(track['id'])
    track['bpm'] = trackAPI['bpm']
    if not 'replayGain' in track or not track['replayGain']:
        track['replayGain'] = "{0:.2f} dB".format((float(trackAPI['gain']) + 18.4) * -1) if 'gain' in trackAPI else ""
    if not 'explicit' in track:
        track['explicit'] = trackAPI['explicit_lyrics']
    if not 'discNumber' in track:
        track['discNumber'] = trackAPI['disk_number']
    track['artist'] = {}
    track['artists'] = []
    for artist in trackAPI['contributors']:
        if artist['id'] != 5080:
            track['artists'].append(artist['name'])
            if not artist['role'] in track['artist']:
                track['artist'][artist['role']] = []
            track['artist'][artist['role']].append(artist['name'])

    if not 'discTotal' in track['album'] or not track['album']['discTotal']:
        if not albumAPI_gw:
            albumAPI_gw = dz.get_album_gw(track['album']['id'])
        track['album']['discTotal'] = albumAPI_gw['NUMBER_DISK']
    if not 'copyright' in track or not track['copyright']:
        if not albumAPI_gw:
            albumAPI_gw = dz.get_album_gw(track['album']['id'])
        track['copyright'] = albumAPI_gw['COPYRIGHT']

    # Fix incorrect day month when detectable
    if int(track['date']['month']) > 12:
        monthTemp = track['date']['month']
        track['date']['month'] = track['date']['day']
        track['date']['day'] = monthTemp
    if int(track['album']['date']['month']) > 12:
        monthTemp = track['album']['date']['month']
        track['album']['date']['month'] = track['album']['date']['day']
        track['album']['date']['day'] = monthTemp

    # Remove featuring from the title
    track['title_clean'] = track['title']
    if "(feat." in track['title_clean'].lower():
        pos = track['title_clean'].lower().find("(feat.")
        tempTrack = track['title_clean'][:pos]
        if ")" in track['title_clean']:
            tempTrack += track['title_clean'][track['title_clean'].find(")", pos + 1) + 1:]
        track['title_clean'] = tempTrack.strip()

    # Create artists strings
    track['mainArtistsString'] = ""
    if 'Main' in track['artist']:
        tot = len(track['artist']['Main'])
        for i, art in enumerate(track['artist']['Main']):
            track['mainArtistsString'] += art
            if tot != i + 1:
                if tot - 1 == i + 1:
                    track['mainArtistsString'] += " & "
                else:
                    track['mainArtistsString'] += ", "
    else:
        track['mainArtistsString'] = track['mainArtist']['name']
    if 'Featured' in track['artist']:
        tot = len(track['artist']['Featured'])
        track['featArtistsString'] = "feat. "
        for i, art in enumerate(track['artist']['Featured']):
            track['featArtistsString'] += art
            if tot != i + 1:
                if tot - 1 == i + 1:
                    track['featArtistsString'] += " & "
                else:
                    track['featArtistsString'] += ", "

    # Create title with feat
    if "(feat." in track['title'].lower():
        track['title_feat'] = track['title']
    elif 'Featured' in track['artist']:
        track['title_feat'] = track['title'] + " ({})".format(track['featArtistsString'])
    else:
        track['title_feat'] = track['title']

    return track


def downloadTrackObj(dz, trackAPI, settings, bitrate, queueItem, extraTrack=None, interface=None):
    result = {}
    if 'cancel' in queueItem:
        result['cancel'] = True
        return result

    if trackAPI['SNG_ID'] == 0:
        result['error'] = {
            'message': "Track not available on Deezer!",
        }
        if 'SNG_TITLE' in trackAPI:
            result['error']['data'] = {
                'id': trackAPI['SNG_ID'],
                'title': trackAPI['SNG_TITLE'],
                'mainArtist': {'name': trackAPI['ART_NAME']}
            }
        if interface:
            queueItem['failed'] += 1
            interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True, 'data': result['error']['data'],
                                           'error': "Track not available on Deezer!"})
        return result
    # Get the metadata
    if extraTrack:
        track = extraTrack
    else:
        track = getTrackData(dz,
                             trackAPI_gw=trackAPI,
                             trackAPI=trackAPI['_EXTRA_TRACK'] if '_EXTRA_TRACK' in trackAPI else None,
                             albumAPI=trackAPI['_EXTRA_ALBUM'] if '_EXTRA_ALBUM' in trackAPI else None
                             )
    if 'cancel' in queueItem:
        result['cancel'] = True
        return result
    print('Downloading: {} - {}'.format(track['mainArtist']['name'], track['title']))
    if track['MD5'] == '':
        if track['fallbackId'] != 0:
            print("Track not yet encoded, using fallback id")
            trackNew = dz.get_track_gw(track['fallbackId'])
            if not 'MD5_ORIGIN' in trackNew:
                trackNew['MD5_ORIGIN'] = dz.get_track_md5(trackNew['SNG_ID'])
            track = parseEssentialTrackData(track, trackNew)
            return downloadTrackObj(dz, trackAPI, settings, bitrate, queueItem, extraTrack=track, interface=interface)
        elif not 'searched' in track and settings['fallbackSearch']:
            print("Track not yet encoded, searching for alternative")
            searchedId = dz.get_track_from_metadata(track['mainArtist']['name'], track['title'],
                                                    track['album']['title'])
            if searchedId != 0:
                trackNew = dz.get_track_gw(searchedId)
                if not 'MD5_ORIGIN' in trackNew:
                    trackNew['MD5_ORIGIN'] = dz.get_track_md5(trackNew['SNG_ID'])
                track = parseEssentialTrackData(track, trackNew)
                track['searched'] = True
                return downloadTrackObj(dz, trackAPI, settings, bitrate, queueItem, extraTrack=track,
                                        interface=interface)
            else:
                print("ERROR: Track not yet encoded and no alternative found!")
                result['error'] = {
                    'message': "Track not yet encoded and no alternative found!",
                    'data': track
                }
                if interface:
                    queueItem['failed'] += 1
                    interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True, 'data': track,
                                                   'error': "Track not yet encoded and no alternative found!"})
                return result
        else:
            print("ERROR: Track not yet encoded!")
            result['error'] = {
                'message': "Track not yet encoded!",
                'data': track
            }
            if interface:
                queueItem['failed'] += 1
                interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True, 'data': track,
                                               'error': "Track not yet encoded!"})
            return result

    # Get the selected bitrate
    format = getPreferredBitrate(dz, track, bitrate, settings['fallbackBitrate'])
    if format == -100:
        print("ERROR: Track not found at desired bitrate. Enable fallback to lower bitrates to fix this issue.")
        result['error'] = {
            'message': "Track not found at desired bitrate.",
            'data': track
        }
        if interface:
            queueItem['failed'] += 1
            interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True, 'data': track,
                                           'error': "Track not found at desired bitrate."})
        return result
    elif format == -200:
        print("ERROR: This track is not available in 360 Reality Audio format. Please select another format.")
        result['error'] = {
            'message': "Track is not available in Reality Audio 360.",
            'data': track
        }
        if interface:
            queueItem['failed'] += 1
            interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True, 'data': track,
                                           'error': "Track is not available in Reality Audio 360."})
        return result
    track['selectedFormat'] = format
    track['dateString'] = formatDate(track['date'], settings['dateFormat'])
    if settings['tags']['savePlaylistAsCompilation'] and "_EXTRA_PLAYLIST" in trackAPI:
        if 'dzcdn.net' in trackAPI["_EXTRA_PLAYLIST"]['picture_small']:
            track['album']['picUrl'] = trackAPI["_EXTRA_PLAYLIST"]['picture_small'][:-24] + "/{}x{}-{}".format(
                track['album']['pic'], settings['embeddedArtworkSize'], settings['embeddedArtworkSize'],
                'none-100-0-0.png' if settings['PNGcovers'] else f'000000-{settings["jpegImageQuality"]}-0-0.jpg')
        else:
            track['album']['picUrl'] = trackAPI["_EXTRA_PLAYLIST"]['picture_xl']
        track['album']['title'] = trackAPI["_EXTRA_PLAYLIST"]['title']
        track['album']['mainArtist'] = {
            'id': trackAPI["_EXTRA_PLAYLIST"]['various_artist']['id'],
            'name': trackAPI["_EXTRA_PLAYLIST"]['various_artist']['name'],
            'pic': trackAPI["_EXTRA_PLAYLIST"]['various_artist']['picture_small'][
                   trackAPI["_EXTRA_PLAYLIST"]['various_artist']['picture_small'].find('artist/') + 7:-24]
        }
        track['album']['artist'] = {"Main": [trackAPI["_EXTRA_PLAYLIST"]['various_artist']['name'], ]}
        track['album']['artists'] = [trackAPI["_EXTRA_PLAYLIST"]['various_artist']['name'], ]
        track['trackNumber'] = trackAPI["POSITION"]
        track['album']['trackTotal'] = trackAPI["_EXTRA_PLAYLIST"]['nb_tracks']
        track['album']['recordType'] = "Compilation"
        track['album']['barcode'] = ""
        track['album']['label'] = ""
        track['album']['date'] = {
            'day': trackAPI["_EXTRA_PLAYLIST"]["creation_date"][8:10],
            'month': trackAPI["_EXTRA_PLAYLIST"]["creation_date"][5:7],
            'year': trackAPI["_EXTRA_PLAYLIST"]["creation_date"][0:4]
        }
        track['discNumber'] = "1"
        track['album']['discTotal'] = "1"
    else:
        if 'date' in track['album']:
            track['date'] = track['album']['date']
        track['album']['picUrl'] = "https://e-cdns-images.dzcdn.net/images/cover/{}/{}x{}-{}".format(
            track['album']['pic'], settings['embeddedArtworkSize'], settings['embeddedArtworkSize'],
            'none-100-0-0.png' if settings['PNGcovers'] else f'000000-{settings["jpegImageQuality"]}-0-0.jpg')
    track['album']['bitrate'] = format
    track['album']['dateString'] = formatDate(track['album']['date'], settings['dateFormat'])

    # Check if user wants the feat in the title
    # 0 => do not change
    # 1 => remove from title
    # 2 => add to title
    if settings['featuredToTitle'] == "1":
        track['title'] = track['title_clean']
    elif settings['featuredToTitle'] == "2":
        track['title'] = track['title_feat']

    # Remove (Album Version) from tracks that have that
    if settings['removeAlbumVersion']:
        if "Album Version" in track['title']:
            track['title'] = re.sub(r' ?\(Album Version\)', "", track['title']).strip()

    # Generate artist tag if needed
    if settings['tags']['multitagSeparator'] != "default":
        if settings['tags']['multitagSeparator'] == "andFeat":
            track['artistsString'] = track['mainArtistsString']
            if 'featArtistsString' in track and settings['featuredToTitle'] != "2":
                track['artistsString'] += " " + track['featArtistsString']
        else:
            track['artistsString'] = settings['tags']['multitagSeparator'].join(track['artists'])
    else:
        track['artistsString'] = ", ".join(track['artists'])

    # Change Title and Artists casing if needed
    if settings['titleCasing'] != "nothing":
        track['title'] = changeCase(track['title'], settings['titleCasing'])
    if settings['artistCasing'] != "nothing":
        track['artistsString'] = changeCase(track['artistsString'], settings['artistCasing'])
        for i, artist in enumerate(track['artists']):
            track['artists'][i] = changeCase(artist, settings['artistCasing'])

    # Generate filename and filepath from metadata
    filename = generateFilename(track, trackAPI, settings)
    (filepath, artistPath, coverPath, extrasPath) = generateFilepath(track, trackAPI, settings)

    if 'cancel' in queueItem:
        result['cancel'] = True
        return result
    # Download and cache coverart
    if settings['tags']['savePlaylistAsCompilation'] and "_EXTRA_PLAYLIST" in trackAPI:
        track['album']['picPath'] = os.path.join(TEMPDIR,
                                                 f"pl{trackAPI['_EXTRA_PLAYLIST']['id']}_{settings['embeddedArtworkSize']}.{'png' if settings['PNGcovers'] else 'jpg'}")
    else:
        track['album']['picPath'] = os.path.join(TEMPDIR,
                                                 f"alb{track['album']['id']}_{settings['embeddedArtworkSize']}.{'png' if settings['PNGcovers'] else 'jpg'}")
    track['album']['picPath'] = downloadImage(track['album']['picUrl'], track['album']['picPath'])

    if os.path.sep in filename:
        tempPath = filename[:filename.rfind(os.path.sep)]
        filepath = os.path.join(filepath, tempPath)
        filename = filename[filename.rfind(os.path.sep) + len(os.path.sep):]
    makedirs(filepath, exist_ok=True)
    writepath = os.path.join(filepath, filename + extensions[track['selectedFormat']])

    # Save lyrics in lrc file
    if settings['syncedLyrics'] and 'sync' in track['lyrics']:
        print(filepath, filename)
        with open(os.path.join(filepath, filename + '.lrc'), 'wb') as f:
            f.write(track['lyrics']['sync'].encode('utf-8'))

    # Save local album art
    if coverPath:
        result['albumURL'] = track['album']['picUrl'].replace(
            f"{settings['embeddedArtworkSize']}x{settings['embeddedArtworkSize']}",
            f"{settings['localArtworkSize']}x{settings['localArtworkSize']}")
        result['albumPath'] = os.path.join(coverPath,
                                           f"{settingsRegexAlbum(settings['coverImageTemplate'], track['album'], settings, trackAPI)}.{'png' if settings['PNGcovers'] else 'jpg'}")

    # Save artist art
    if artistPath:
        result['artistURL'] = "https://e-cdns-images.dzcdn.net/images/artist/{}/{}x{}-{}".format(
            track['album']['mainArtist']['pic'], settings['localArtworkSize'], settings['localArtworkSize'],
            'none-100-0-0.png' if settings['PNGcovers'] else f'000000-{settings["jpegImageQuality"]}-0-0.jpg')
        result['artistPath'] = os.path.join(artistPath,
                                            f"{settingsRegexArtist(settings['artistImageTemplate'], track['album']['mainArtist'], settings)}.{'png' if settings['PNGcovers'] else 'jpg'}")

    # Data for m3u file
    if extrasPath:
        result['extrasPath'] = extrasPath
        result['playlistPosition'] = writepath[len(extrasPath):]

    track['downloadUrl'] = dz.get_track_stream_url(track['id'], track['MD5'], track['mediaVersion'],
                                                   track['selectedFormat'])
    try:
        with open(writepath, 'wb') as stream:
            stream_track(dz, track, stream, trackAPI, queueItem, interface)
    except downloadCancelled:
        remove(writepath)
        result['cancel'] = True
        return result
    except HTTPError:
        remove(writepath)
        if track['fallbackId'] != 0:
            print("Track not available, using fallback id")
            trackNew = dz.get_track_gw(track['fallbackId'])
            if not 'MD5_ORIGIN' in trackNew:
                trackNew['MD5_ORIGIN'] = dz.get_track_md5(trackNew['SNG_ID'])
            track = parseEssentialTrackData(track, trackNew)
            return downloadTrackObj(dz, trackAPI, settings, bitrate, queueItem, extraTrack=track, interface=interface)
        elif not 'searched' in track and settings['fallbackSearch']:
            print("Track not available, searching for alternative")
            searchedId = dz.get_track_from_metadata(track['mainArtist']['name'], track['title'],
                                                    track['album']['title'])
            if searchedId != 0:
                trackNew = dz.get_track_gw(searchedId)
                if not 'MD5_ORIGIN' in trackNew:
                    trackNew['MD5_ORIGIN'] = dz.get_track_md5(trackNew['SNG_ID'])
                track = parseEssentialTrackData(track, trackNew)
                track['searched'] = True
                return downloadTrackObj(dz, trackAPI, settings, bitrate, queueItem, extraTrack=track,
                                        interface=interface)
            else:
                print("ERROR: Track not available on deezer's servers and no alternative found!")
                result['error'] = {
                    'message': "Track not available on deezer's servers and no alternative found!",
                    'data': track
                }
                if interface:
                    queueItem['failed'] += 1
                    interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True, 'data': track,
                                                   'error': "Track not available on deezer's servers and no alternative found!"})
                return result
        else:
            print("ERROR: Track not available on deezer's servers!")
            result['error'] = {
                'message': "Track not available on deezer's servers!",
                'data': track
            }
            if interface:
                queueItem['failed'] += 1
                interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True, 'data': track,
                                               'error': "Track not available on deezer's servers!"})
            return result
    if track['selectedFormat'] in [3, 1, 8]:
        tagID3(writepath, track, settings['tags'])
    elif track['selectedFormat'] == 9:
        tagFLAC(writepath, track, settings['tags'])
    if 'searched' in track:
        result['searched'] = f'{track["mainArtist"]["name"]} - {track["title"]}'
    print("Done!")
    if interface:
        queueItem['downloaded'] += 1
        interface.send("updateQueue", {'uuid': queueItem['uuid'], 'downloaded': True})
    return result


def downloadTrackObj_wrap(dz, track, settings, bitrate, queueItem, interface):
    try:
        result = downloadTrackObj(dz, track, settings, bitrate, queueItem, interface=interface)
    except Exception as e:
        traceback.print_exc()
        result = {'error': {
            'message': str(e),
            'data': {
                'id': track['SNG_ID'],
                'title': track['SNG_TITLE'] + (
                    " " + track['VERSION'] if 'VERSION' in track and track['VERSION'] else ""),
                'mainArtist': {'name': track['ART_NAME']}
            }
        }
        }
        if interface:
            queueItem['failed'] += 1
            interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True})
    return result


def download(dz, queueItem, interface=None):
    global downloadPercentage, lastPercentage
    settings = queueItem['settings']
    bitrate = queueItem['bitrate']
    downloadPercentage = 0
    lastPercentage = 0
    if 'single' in queueItem:
        try:
            result = downloadTrackObj(dz, queueItem['single'], settings, bitrate, queueItem, interface=interface)
        except Exception as e:
            traceback.print_exc()
            result = {'error': {
                'message': str(e),
                'data': {
                    'id': queueItem['single']['SNG_ID'],
                    'title': queueItem['single']['SNG_TITLE'] + (
                        " " + queueItem['single']['VERSION'] if 'VERSION' in queueItem['single'] and
                                                                queueItem['single']['VERSION'] else ""),
                    'mainArtist': {'name': queueItem['single']['ART_NAME']}
                }
            }
            }
            if interface:
                queueItem['failed'] += 1
                interface.send("updateQueue", {'uuid': queueItem['uuid'], 'failed': True})
        download_path = after_download_single(result, settings, queueItem)
    elif 'collection' in queueItem:
        print("Downloading collection")
        playlist = [None] * len(queueItem['collection'])
        with ThreadPoolExecutor(settings['queueConcurrency']) as executor:
            for pos, track in enumerate(queueItem['collection'], start=0):
                playlist[pos] = executor.submit(downloadTrackObj_wrap, dz, track, settings, bitrate, queueItem,
                                                interface=interface)
        download_path = after_download(playlist, settings, queueItem)
    if interface:
        if 'cancel' in queueItem:
            interface.send('toast', {'msg': "Current item cancelled.", 'icon': 'done', 'dismiss': True,
                                     'id': 'cancelling_' + queueItem['uuid']})
            interface.send("removedFromQueue", queueItem['uuid'])
        else:
            interface.send("finishDownload", queueItem['uuid'])
    return {
        'dz': dz,
        'interface': interface,
        'download_path': download_path
    }


def after_download(tracks, settings, queueItem):
    extrasPath = None
    playlist = [None] * len(tracks)
    errors = ""
    searched = ""
    for index in range(len(tracks)):
        result = tracks[index].result()
        if 'cancel' in result:
            return None
        if 'error' in result:
            if not 'data' in result['error']:
                result['error']['data'] = {'id': 0, 'title': 'Unknown', 'mainArtist': {'name': 'Unknown'}}
            errors += f"{result['error']['data']['id']} | {result['error']['data']['mainArtist']['name']} - {result['error']['data']['title']} | {result['error']['message']}\r\n"
        if 'searched' in result:
            searched += result['searched'] + "\r\n"
        if not extrasPath and 'extrasPath' in result:
            extrasPath = result['extrasPath']
        if settings['saveArtwork'] and 'albumPath' in result:
            downloadImage(result['albumURL'], result['albumPath'])
        if settings['saveArtworkArtist'] and 'artistPath' in result:
            downloadImage(result['artistURL'], result['artistPath'])
        if 'playlistPosition' in result:
            playlist[index] = result['playlistPosition']
        else:
            playlist[index] = ""
    if not extrasPath:
        extrasPath = settings['downloadLocation']
    if settings['logErrors'] and errors != "":
        with open(os.path.join(extrasPath, 'errors.txt'), 'wb') as f:
            f.write(errors.encode('utf-8'))
    if settings['logSearched'] and searched != "":
        with open(os.path.join(extrasPath, 'searched.txt'), 'wb') as f:
            f.write(searched.encode('utf-8'))
    if settings['createM3U8File']:
        with open(os.path.join(extrasPath, 'playlist.m3u8'), 'wb') as f:
            for line in playlist:
                f.write((line + "\n").encode('utf-8'))
    if settings['executeCommand'] != "":
        execute(settings['executeCommand'].replace("%folder%", extrasPath))
    return extrasPath


def after_download_single(track, settings, queueItem):
    if 'cancel' in track:
        return None
    if 'extrasPath' not in track:
        track['extrasPath'] = settings['downloadLocation']
    if settings['logSearched'] and 'searched' in track:
        with open(os.path.join(track['extrasPath'], 'searched.txt'), 'wb+') as f:
            orig = f.read().decode('utf-8')
            if not track['searched'] in orig:
                if orig != "":
                    orig += "\r\n"
                orig += track['searched'] + "\r\n"
            f.write(orig.encode('utf-8'))
    if settings['executeCommand'] != "":
        execute(settings['executeCommand'].replace("%folder%", track['extrasPath']))
    return track['extrasPath']


class downloadCancelled(Exception):
    """Base class for exceptions in this module."""
    pass
