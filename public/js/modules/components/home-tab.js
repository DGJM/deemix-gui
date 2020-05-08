import { socket } from '../socket.js'
import { artistView, albumView, playlistView } from '../tabs.js'
import Downloads from '../downloads.js'
import QualityModal from '../quality-modal.js'
import TrackPreview from '../track-preview.js'
import Utils from '../utils.js'

const HomeTab = new Vue({
	data() {
		return {
			tracks: [],
			albums: [],
			artists: [],
			playlists: []
		}
	},
	methods: {
		artistView,
		albumView,
		playlistView,
		playPausePreview: TrackPreview.playPausePreview,
		previewMouseEnter: TrackPreview.previewMouseEnter,
		previewMouseLeave: TrackPreview.previewMouseLeave,
		numberWithDots: Utils.numberWithDots,
		convertDuration: Utils.convertDuration,
		addToQueue(e) {
			e.stopPropagation()
			Downloads.sendAddToQueue(e.currentTarget.dataset.link)
		},
		openQualityModal(e) {
			QualityModal.open(e.currentTarget.dataset.link)
		},
		initHome(data) {
			this.tracks = data.tracks.data
			this.albums = data.albums.data
			this.artists = data.artists.data
			this.playlists = data.playlists.data
		}
	},
	mounted() {
		socket.on('init_home', this.initHome)
	}
}).$mount('#home_tab')

export default HomeTab
