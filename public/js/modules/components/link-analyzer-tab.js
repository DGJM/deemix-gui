import { socket } from '../socket.js'
import { albumView } from '../tabs.js'
import Utils from '../utils.js'

const LinkAnalyzerTab = new Vue({
	data() {
		return {
			title: '',
			subtitle: '',
			image: '',
			data: {},
			type: '',
			link: '',
			countries: []
		}
	},
	methods: {
		albumView,
		convertDuration: Utils.convertDuration,
		reset() {
			this.title = 'Loading...'
			this.subtitle = ''
			this.image = ''
			this.data = {}
			this.type = ''
			this.link = ''
			this.countries = []
		},
		showTrack(data) {
			this.title =
				data.title +
				(data.title_version && data.title.indexOf(data.title_version) == -1 ? ' ' + data.title_version : '')
			this.subtitle = `by ${data.artist.name}\nin ${data.album.title}`
			this.image = data.album.cover_xl
			this.type = 'track'
			this.link = data.link
			data.available_countries.forEach(cc => {
				let temp = []
				let chars = [...cc].map(c => c.charCodeAt() + 127397)
				temp.push(String.fromCodePoint(...chars))
				temp.push(Utils.COUNTRIES[cc])
				this.countries.push(temp)
			})
			this.data = data
		},
		showAlbum(data) {
			console.log(data)
			this.title = data.title
			this.subtitle = `by ${data.artist.name}\n${data.nb_tracks} tracks`
			this.image = data.cover_xl
			this.type = 'album'
			this.link = data.link
			this.data = data
		}
	},
	mounted() {
		socket.on('analyze_track', this.showTrack)
		socket.on('analyze_album', this.showAlbum)
	}
}).$mount('#analyzer_tab')

export default LinkAnalyzerTab
