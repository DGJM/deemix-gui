import { toast } from '../toasts.js'
import { socket } from '../socket.js'

const SettingsTab = new Vue({
	data: () => ({
		settings: { tags: {} },
		lastSettings: {},
		spotifyFeatures: {},
		lastCredentials: {},
		defaultSettings: {},
		lastUser: '',
		spotifyUser: '',
		darkMode: false,
		slimDownloads: false
	}),
	computed: {
		changeDarkMode: {
			get() {
				return this.darkMode
			},
			set(wantDarkMode) {
				this.darkMode = wantDarkMode
				document.documentElement.setAttribute('data-theme', wantDarkMode ? 'dark' : 'default')
				localStorage.setItem('darkMode', wantDarkMode)
			}
		},
		changeSlimDownloads: {
			get() {
				return this.slimDownloads
			},
			set(wantSlimDownloads) {
				this.slimDownloads = wantSlimDownloads
				document.getElementById('download_list').classList.toggle('slim', wantSlimDownloads)
				localStorage.setItem('slimDownloads', wantSlimDownloads)
			}
		}
	},
	methods: {
		copyARLtoClipboard() {
			let copyText = this.$refs.loginInput

			copyText.setAttribute('type', 'text')
			copyText.select()
			copyText.setSelectionRange(0, 99999)
			document.execCommand('copy')
			copyText.setAttribute('type', 'password')

			toast('ARL copied to clipboard', 'assignment')
		},
		saveSettings() {
			this.lastSettings = { ...this.settings }
			this.lastCredentials = { ...this.spotifyFeatures }
			let changed = false
			if (this.lastUser != this.spotifyUser) {
				// force cloning without linking
				this.lastUser = (' ' + this.spotifyUser).slice(1)
				localStorage.setItem('spotifyUser', this.lastUser)
				changed = true
			}

			socket.emit('saveSettings', this.lastSettings, this.lastCredentials, changed ? this.lastUser : false)
			console.log(this.darkMode)
		},
		loadSettings(settings, spotifyCredentials, defaults = null) {
			if (defaults) {
				this.defaultSettings = { ...defaults }
			}

			this.lastSettings = { ...settings }
			this.lastCredentials = { ...spotifyCredentials }
			this.settings = settings
			this.spotifyFeatures = spotifyCredentials
		},
		login() {
			let arl = this.$refs.loginInput.value
			if (arl != '' && arl != localStorage.getItem('arl')) {
				socket.emit('login', arl, true)
			}
		},
		logout() {
			socket.emit('logout')
		},
		initSettings(settings, credentials, defaults) {
			this.loadSettings(settings, credentials, defaults)
			toast('Settings loaded!', 'settings')
		},
		updateSettings(settings, credentials) {
			this.loadSettings(settings, credentials)
			toast('Settings updated!', 'settings')
		},
		resetSettings() {
			this.settings = { ...this.defaultSettings }
		}
	},
	mounted() {
		socket.on('init_settings', this.initSettings)
		socket.on('updateSettings', this.updateSettings)

		let spotyUser = localStorage.getItem('spotifyUser')

		if ('' !== spotyUser) {
			this.lastUser = spotyUser
			this.spotifyUser = spotyUser
		}

		this.changeDarkMode = 'true' === localStorage.getItem('darkMode')
		this.changeSlimDownloads = 'true' === localStorage.getItem('slimDownloads')
	}
}).$mount('#settings_tab')

export default SettingsTab
