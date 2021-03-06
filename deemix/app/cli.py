#!/usr/bin/env python3
import os.path as path
from os import mkdir

from deemix.utils import localpaths
from deemix.api.deezer import Deezer
from deemix.app.queuemanager import addToQueue
from deemix.app.spotify import SpotifyHelper

dz = Deezer()
sp = SpotifyHelper()


def requestValidArl():
    while True:
        arl = input("Paste here your arl:")
        if dz.login_via_arl(arl):
            break
    return arl


def login():
    configFolder = localpaths.getConfigFolder()
    if not path.isdir(configFolder):
        mkdir(configFolder)
    if path.isfile(path.join(configFolder, '.arl')):
        with open(path.join(configFolder, '.arl'), 'r') as f:
            arl = f.read()
        if not dz.login_via_arl(arl):
            arl = requestValidArl()
    else:
        arl = requestValidArl()
    with open(path.join(configFolder, '.arl'), 'w') as f:
        f.write(arl)


def downloadLink(url, settings, bitrate=None):
    addToQueue(dz, sp, url, settings, bitrate)
