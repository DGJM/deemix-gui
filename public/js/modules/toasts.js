import { socket } from './socket.js'

let toastsWithId = {}

export const toast = function (msg, icon = null, dismiss = true, id = null) {
	if (toastsWithId[id]) {
		let toastObj = toastsWithId[id]
		let toastDOM = $(`div.toastify[toast_id=${id}]`)
		if (msg) {
			toastDOM.find('.toast-message').html(msg)
		}
		if (icon) {
			if (icon == 'loading') icon = `<div class="circle-loader"></div>`
			else icon = `<i class="material-icons">${icon}</i>`
			toastDOM.find('.toast-icon').html(icon)
		}
		if (dismiss !== null && dismiss) {
			setTimeout(function () {
				toastObj.hideToast()
				delete toastsWithId[id]
			}, 3000)
		}
	} else {
		if (icon == null) icon = ''
		else if (icon == 'loading') icon = `<div class="circle-loader"></div>`
		else icon = `<i class="material-icons">${icon}</i>`
		let toastObj = Toastify({
			text: `<span class="toast-icon">${icon}</span><span class="toast-message">${msg}</toast>`,
			duration: dismiss ? 3000 : 0,
			gravity: 'bottom',
			position: 'left'
		}).showToast()
		if (id) {
			toastsWithId[id] = toastObj
			$(toastObj.toastElement).attr('toast_id', id)
		}
	}
}

socket.on('toast', data => {
	toast(data.msg, data.icon || null, data.dismiss !== undefined ? data.dismiss : true, data.id || null)
})
