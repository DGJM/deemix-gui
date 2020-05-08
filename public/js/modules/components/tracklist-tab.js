import { socket } from '../socket.js'
import { albumView, artistView } from '../tabs.js'
import Downloads from '../downloads.js'
import QualityModal from '../quality-modal.js'
import TrackPreview from '../track-preview.js'

const TracklistTab = new Vue({
	data: () => ({
		title: '',
		metadata: '',
		release_date: '',
		label: '',
		explicit: false,
		image: '',
		type: '',
		link: '',
		head: null,
		body: []
	}),
	methods: {
		artistView,
		albumView,
		playPausePreview: TrackPreview.playPausePreview,
		reset() {
			this.title = 'Loading...'
			this.image = ''
			this.metadata = ''
			this.label = ''
			this.release_date = ''
			this.explicit = false
			this.type = ''
			this.head = []
			this.body = []
		},
		addToQueue(e) {
			e.stopPropagation()
			Downloads.sendAddToQueue(e.currentTarget.dataset.link)
		},
		openQualityModal(e) {
			QualityModal.open(e.currentTarget.dataset.link)
		},
		toggleAll(e) {
			this.body.forEach(item => {
				if (item.type == 'track') {
					item.selected = e.currentTarget.checked
				}
			})
		},
		selectedLinks() {
			var selected = []
			if (this.body) {
				this.body.forEach(item => {
					if (item.type == 'track' && item.selected) selected.push(this.type == "Spotify Playlist" ? item.uri : item.link)
				})
			}
			return selected.join(';')
		},
		convertDuration(duration) {
			//convert from seconds only to mm:ss format
			let mm, ss
			mm = Math.floor(duration / 60)
			ss = duration - mm * 60
			//add leading zero if ss < 0
			if (ss < 10) {
				ss = '0' + ss
			}
			return mm + ':' + ss
		},
		showAlbum(data) {
			this.type = 'Album'
			this.link = `https://www.deezer.com/album/${data.id}`
			this.title = data.title
			this.explicit = data.explicit_lyrics
			this.label = data.label
			this.metadata = `${data.artist.name} • ${data.tracks.length} songs`
			this.release_date = data.release_date.substring(0, 10)
			this.image = data.cover_xl
			this.head = [
				{ title: '<i class="material-icons">music_note</i>', width: '24px' },
				{ title: '#' },
				{ title: 'Song' },
				{ title: 'Artist' },
				{ title: '<i class="material-icons">timer</i>', width: '40px' }
			]
			if (_.isEmpty(data.tracks)) {
				console.log('show e lodash ok')

				this.body = null
			} else {
				this.body = data.tracks
			}
		},
		showPlaylist(data) {
			this.type = 'Playlist'
			this.link = `https://www.deezer.com/playlist/${data.id}`
			this.title = data.title
			this.image = data.picture_xl
			this.release_date = data.creation_date.substring(0, 10)
			this.metadata = `by ${data.creator.name} • ${data.tracks.length} songs`
			this.head = [
				{ title: '<i class="material-icons">music_note</i>', width: '24px' },
				{ title: '#' },
				{ title: 'Song' },
				{ title: 'Artist' },
				{ title: 'Album' },
				{ title: '<i class="material-icons">timer</i>', width: '40px' }
			]
			if (_.isEmpty(data.tracks)) {
				this.body = null
			} else {
				this.body = data.tracks
			}
		},
		showSpotifyPlaylist(data) {
			this.type = 'Spotify Playlist'
			this.link = data.uri
			this.title = data.name
			this.image = data.images.length ? data.images[0].url : "https://e-cdns-images.dzcdn.net/images/cover/d41d8cd98f00b204e9800998ecf8427e/1000x1000-000000-80-0-0.jpg"
			this.release_date = ""
			this.metadata = `by ${data.owner.display_name} • ${data.tracks.length} songs`
			this.head = [
				{ title: '<i class="material-icons">music_note</i>', width: '24px' },
				{ title: '#' },
				{ title: 'Song' },
				{ title: 'Artist' },
				{ title: 'Album' },
				{ title: '<i class="material-icons">timer</i>', width: '40px' }
			]
			if (_.isEmpty(data.tracks)) {
				this.body = null
			} else {
				this.body = data.tracks
			}
		}
	},
	mounted() {
		socket.on('show_album', this.showAlbum)
		socket.on('show_playlist', this.showPlaylist)
		socket.on('show_spotifyplaylist', this.showSpotifyPlaylist)
	}
}).$mount('#tracklist_tab')

export default TracklistTab
