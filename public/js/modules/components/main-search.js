import { socket } from '../socket.js'
import { artistView, albumView, playlistView } from '../tabs.js'
import Downloads from '../downloads.js'
import QualityModal from '../quality-modal.js'
import TrackPreview from '../track-preview.js'
import Utils from '../utils.js'

const MainSearch = new Vue({
	data: {
		names: {
			TOP_RESULT: 'Top Result',
			TRACK: 'Tracks',
			ARTIST: 'Artists',
			ALBUM: 'Albums',
			PLAYLIST: 'Playlists'
		},
		results: {
			query: '',
			allTab: {
				ORDER: [],
				TOP_RESULT: [],
				ALBUM: {},
				ARTIST: {},
				TRACK: {},
				PLAYLIST: {}
			},
			trackTab: {
				data: [],
				next: 0,
				total: 0,
				loaded: false
			},
			albumTab: {
				data: [],
				next: 0,
				total: 0,
				loaded: false
			},
			artistTab: {
				data: [],
				next: 0,
				total: 0,
				loaded: false
			},
			playlistTab: {
				data: [],
				next: 0,
				total: 0,
				loaded: false
			}
		}
	},
	methods: {
		artistView,
		albumView,
		playlistView,
		playPausePreview: TrackPreview.playPausePreview,
		previewMouseEnter: TrackPreview.previewMouseEnter,
		previewMouseLeave: TrackPreview.previewMouseLeave,
		handleClickTopResult(event) {
			let topResultType = this.results.allTab.TOP_RESULT[0].type

			switch (topResultType) {
				case 'artist':
					this.artistView(event)
					break
				case 'album':
					this.albumView(event)
					break
				case 'playlist':
					this.playlistView(event)
					break

				default:
					break
			}
		},
		changeSearchTab(section) {
			if (section != 'TOP_RESULT') {
				document.getElementById(`search_${section.toLowerCase()}_tab`).click()
			}
		},
		addToQueue: function (e) {
			Downloads.sendAddToQueue(e.currentTarget.dataset.link)
		},
		openQualityModal: function (e) {
			QualityModal.open(e.currentTarget.dataset.link)
		},
		numberWithDots: Utils.numberWithDots,
		convertDuration: Utils.convertDuration,
		search(type) {
			socket.emit('search', {
				term: this.results.query,
				type: type,
				start: this.results[type + 'Tab'].next,
				nb: 30
			})
		},
		scrolledSearch(type) {
			if (this.results[type + 'Tab'].next < this.results[type + 'Tab'].total) {
				socket.emit('search', {
					term: this.results.query,
					type: type,
					start: this.results[type + 'Tab'].next,
					nb: 30
				})
			}
		},
		handleMainSearch(result) {
			let resetObj = { data: [], next: 0, total: 0, loaded: false }
			this.results.allTab = result
			this.results.query = result.QUERY
			this.results.trackTab = { ...resetObj }
			this.results.albumTab = { ...resetObj }
			this.results.artistTab = { ...resetObj }
			this.results.playlistTab = { ...resetObj }
			document.getElementById('search_all_tab').click()
			document.getElementById('search_tab_content').style.display = 'block'
			document.getElementById('main_search_tablink').click()
		},
		handleSearch(result) {
			let next = 0

			if (result.next) {
				next = parseInt(result.next.match(/index=(\d*)/)[1])
			} else {
				next = result.total
			}

			if (this.results[result.type + 'Tab'].total != result.total) {
				this.results[result.type + 'Tab'].total = result.total
			}

			if (this.results[result.type + 'Tab'].next != next) {
				this.results[result.type + 'Tab'].next = next
				this.results[result.type + 'Tab'].data = this.results[result.type + 'Tab'].data.concat(result.data)
			}
			this.results[result.type + 'Tab'].loaded = true
		}
	},
	mounted() {
		socket.on('mainSearch', this.handleMainSearch)
		socket.on('search', this.handleSearch)
	}
}).$mount('#search_tab')

export default MainSearch
