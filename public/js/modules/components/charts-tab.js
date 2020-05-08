import { socket } from '../socket.js'
import { artistView, albumView } from '../tabs.js'
import Downloads from '../downloads.js'
import QualityModal from '../quality-modal.js'
import TrackPreview from '../track-preview.js'
import Utils from '../utils.js'

const ChartsTab = new Vue({
	data() {
		return {
			country: '',
      id: 0,
      countries: [],
      chart: []
		}
	},
	methods: {
    artistView,
		albumView,
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
    getTrackList(e){
      this.country = e.currentTarget.dataset.title
      localStorage.setItem('chart', this.country)
      this.id = e.currentTarget.dataset.id
      socket.emit('getChartTracks', this.id)
    },
    setTracklist(data){
      this.chart = data
    },
    changeCountry(){
      this.country = ''
      this.id = 0
    },
		initCharts(data) {
      this.countries = data
      this.country = localStorage.getItem('chart') || ''
      if (this.country){
        let i = 0
        for (i; i < this.countries.length; i++) if (this.countries[i].title == this.country) break
        if (i != this.countries.length){
          this.id = this.countries[i].id
          socket.emit('getChartTracks', this.id)
        }else{
          this.country = ''
          localStorage.setItem('chart', this.country)
        }
      }
		}
	},
	mounted() {
		socket.on('init_charts', this.initCharts)
    socket.on('setChartTracks', this.setTracklist)
	}
}).$mount('#charts_tab')

export default ChartsTab
