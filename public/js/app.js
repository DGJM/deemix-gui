import { socket } from './modules/socket.js'
import { toast } from './modules/toasts.js'
import Downloads from './modules/downloads.js'
import QualityModal from './modules/quality-modal.js'
import Tabs from './modules/tabs.js'
import Search from './modules/search.js'
import TrackPreview from './modules/track-preview.js'

/* ===== Socketio listeners ===== */

// Debug messages for socketio
socket.on('message', function (msg) {
	console.log(msg)
})

socket.on('logging_in', function () {
	toast('Logging in', 'loading', false, 'login-toast')
})

socket.on('logged_in', function (data) {
	switch (data.status) {
		case 1:
		case 3:
			toast('Logged in', 'done', true, 'login-toast')
			if (data.arl) {
				localStorage.setItem('arl', data.arl)
				$('#login_input_arl').val(data.arl)
			}
			$('#open_login_prompt').hide()
			if (data.user) {
				$('#settings_username').text(data.user.name)
				$('#settings_picture').attr(
					'src',
					`https://e-cdns-images.dzcdn.net/images/user/${data.user.picture}/125x125-000000-80-0-0.jpg`
				)
				// $('#logged_in_info').show()
				document.getElementById('logged_in_info').classList.remove('hide')
			}
			break
		case 2:
			toast('Already logged in', 'done', true, 'login-toast')
			if (data.user) {
				$('#settings_username').text(data.user.name)
				$('#settings_picture').attr(
					'src',
					`https://e-cdns-images.dzcdn.net/images/user/${data.user.picture}/125x125-000000-80-0-0.jpg`
				)
				// $('#logged_in_info').show()
				document.getElementById('logged_in_info').classList.remove('hide')
			}
			break
		case 0:
			toast("Couldn't log in", 'close', true, 'login-toast')
			localStorage.removeItem('arl')
			$('#login_input_arl').val('')
			$('#open_login_prompt').show()
			document.getElementById('logged_in_info').classList.add('hide')
			// $('#logged_in_info').hide()
			$('#settings_username').text('Not Logged')
			$('#settings_picture').attr('src', `https://e-cdns-images.dzcdn.net/images/user/125x125-000000-80-0-0.jpg`)
			break
	}
})

socket.on('logged_out', function () {
	toast('Logged out', 'done', true, 'login-toast')
	localStorage.removeItem('arl')
	$('#login_input_arl').val('')
	$('#open_login_prompt').show()
	document.getElementById('logged_in_info').classList.add('hide')
	// $('#logged_in_info').hide()
	$('#settings_username').text('Not Logged')
	$('#settings_picture').attr('src', `https://e-cdns-images.dzcdn.net/images/user/125x125-000000-80-0-0.jpg`)
})

/* ===== App initialization ===== */
function startApp() {
	Downloads.init()
	QualityModal.init()
	Tabs.linkListeners()
	Search.linkListeners()
	TrackPreview.init()

	document.getElementById('logged_in_info').classList.add('hide')

	if (localStorage.getItem('arl')) {
		let arl = localStorage.getItem('arl')

		socket.emit('login', arl)
		$('#login_input_arl').val(arl)
	}
	if ('true' === localStorage.getItem('slimDownloads')) {
		document.getElementById('download_list').classList.add('slim')
	}
	let spotifyUser = localStorage.getItem('spotifyUser')
	if (spotifyUser != '') {
		socket.emit('update_userSpotifyPlaylists', spotifyUser)
	}
	// Open default tab
	document.getElementById('main_home_tablink').click()
}

document.addEventListener('DOMContentLoaded', startApp)
