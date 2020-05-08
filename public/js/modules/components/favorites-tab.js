import { socket } from '../socket.js'
import { playlistView, artistView, albumView, spotifyPlaylistView } from '../tabs.js'
import Downloads from '../downloads.js'
import QualityModal from '../quality-modal.js'
import TrackPreview from '../track-preview.js'
import Utils from '../utils.js'

const FavoritesTab = new Vue({
	data() {
		return {
			tracks: [],
			albums: [],
			artists: [],
			playlists: [],
			spotifyPlaylists: []
		}
	},
	methods: {
		playlistView,
		artistView,
		albumView,
		spotifyPlaylistView,
		playPausePreview: TrackPreview.playPausePreview,
		previewMouseEnter: TrackPreview.previewMouseEnter,
		previewMouseLeave: TrackPreview.previewMouseLeave,
		convertDuration: Utils.convertDuration,
		addToQueue(e) {
			e.stopPropagation()
			Downloads.sendAddToQueue(e.currentTarget.dataset.link)
		},
		openQualityModal(e) {
			QualityModal.open(e.currentTarget.dataset.link)
		},
		updated_userSpotifyPlaylists(data){this.spotifyPlaylists = data},
		updated_userPlaylists(data){this.playlists = data},
		updated_userAlbums(data){this.albums = data},
		updated_userArtist(data){this.artists = data},
		updated_userTracks(data){this.tracks = data},
		initFavorites(data) {
			this.tracks = data.tracks
			this.albums = data.albums
			this.artists = data.artists
			this.playlists = data.playlists
			document.getElementById('favorites_playlist_tab').click()
		}
	},
	mounted() {
		socket.on('init_favorites', this.initFavorites)
		socket.on('updated_userSpotifyPlaylists', this.updated_userSpotifyPlaylists)
		socket.on('updated_userPlaylists', this.updated_userPlaylists)
		socket.on('updated_userAlbums', this.updated_userAlbums)
		socket.on('updated_userArtist', this.updated_userArtist)
		socket.on('updated_userTracks', this.updated_userTracks)
	}
}).$mount('#favorites_tab')

export default FavoritesTab
