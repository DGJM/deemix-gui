export const socket = io.connect(window.location.href)

socket.on('connect', () => {
	document.getElementById('loading_overlay').classList.remove('active')
})
