import { socket } from './socket.js'
import { toast } from './toasts.js'

/* ===== Locals ===== */
const tabMinWidth = 250
const tabMaxWidth = 500

let cachedTabWidth = parseInt(localStorage.getItem('downloadTabWidth')) || 300
let queueList = {}
let queue = []
let queueComplete = []
let tabContainerEl
let listEl
let dragHandlerEl

function init() {
	// Find download DOM elements
	tabContainerEl = document.getElementById('download_tab_container')
	listEl = document.getElementById('download_list')
	dragHandlerEl = document.getElementById('download_tab_drag_handler')

	// Check if download tab should be open
	if ('true' === localStorage.getItem('downloadTabOpen')) {
		tabContainerEl.classList.remove('tab_hidden')

		setTabWidth(cachedTabWidth)
	}

	linkListeners()
}

function linkListeners() {
	listEl.addEventListener('click', handleListClick)
	document.getElementById('toggle_download_tab').addEventListener('click', toggleDownloadTab)

	// Queue buttons
	document.getElementById('clean_queue').addEventListener('click', () => {
		socket.emit('removeFinishedDownloads')
	})

	document.getElementById('cancel_queue').addEventListener('click', () => {
		socket.emit('cancelAllDownloads')
	})

	dragHandlerEl.addEventListener('mousedown', event => {
		event.preventDefault()

		document.addEventListener('mousemove', handleDrag)
	})

	document.addEventListener('mouseup', () => {
		document.removeEventListener('mousemove', handleDrag)
	})

	tabContainerEl.addEventListener('transitionend', () => {
		tabContainerEl.style.transition = ''
	})

	window.addEventListener('beforeunload', () => {
		localStorage.setItem('downloadTabWidth', cachedTabWidth)
	})
}

function setTabWidth(newWidth) {
	if (undefined === newWidth) {
		tabContainerEl.style.width = ''
		listEl.style.width = ''
	} else {
		tabContainerEl.style.width = newWidth + 'px'
		listEl.style.width = newWidth + 'px'
	}
}

function handleDrag(event) {
	let newWidth = window.innerWidth - event.pageX + 2

	if (newWidth < tabMinWidth) {
		newWidth = tabMinWidth
	} else if (newWidth > tabMaxWidth) {
		newWidth = tabMaxWidth
	}

	cachedTabWidth = newWidth

	setTabWidth(newWidth)
}

function sendAddToQueue(url, bitrate = null) {
	if (url.indexOf(';') !== -1) {
		let urls = url.split(';')
		urls.forEach(url => {
			socket.emit('addToQueue', { url: url, bitrate: bitrate })
		})
	} else if (url != '') {
		socket.emit('addToQueue', { url: url, bitrate: bitrate })
	}
}

function addToQueue(queueItem, current = false) {
	queueList[queueItem.uuid] = queueItem
	if (queueItem.downloaded + queueItem.failed == queueItem.size) {
		queueComplete.push(queueItem.uuid)
	} else {
		queue.push(queueItem.uuid)
	}
	$(listEl).append(
		`<div class="download_object" id="download_${queueItem.uuid}" data-deezerid="${queueItem.id}">
		<div class="download_info">
			<img width="75px" class="rounded coverart" src="${queueItem.cover}" alt="Cover ${queueItem.title}"/>
			<div class="download_info_data">
				<span class="download_line">${queueItem.title}</span> <span class="download_slim_separator"> - </span>
				<span class="secondary-text">${queueItem.artist}</span>
			</div>
			<div class="download_info_status">
				<span class="download_line"><span class="queue_downloaded">${queueItem.downloaded + queueItem.failed}</span>/${
			queueItem.size
		}</span>
			</div>
		</div>
		<div class="download_bar">
			<div class="progress"><div id="bar_${queueItem.uuid}" class="indeterminate"></div></div>
			<i class="material-icons queue_icon" data-uuid="${queueItem.uuid}">remove</i>
		</div>
	</div>`
	)
	if (queueItem.progress > 0 || current) {
		$('#bar_' + queueItem.uuid)
			.removeClass('indeterminate')
			.addClass('determinate')
	}
	$('#bar_' + queueItem.uuid).css('width', queueItem.progress + '%')
	if (queueItem.failed >= 1) {
		$('#download_' + queueItem.uuid + ' .download_info_status').append(
			`<span class="secondary-text inline-flex"><span class="download_slim_separator">(</span><span class="queue_failed">${queueItem.failed}</span><i class="material-icons">error_outline</i><span class="download_slim_separator">)</span></span>`
		)
	}
	if (queueItem.downloaded + queueItem.failed == queueItem.size) {
		let result_icon = $('#download_' + queueItem.uuid).find('.queue_icon')
		if (queueItem.failed == 0) {
			result_icon.text('done')
		} else if (queueItem.failed == queueItem.size) {
			result_icon.text('error')
		} else {
			result_icon.text('warning')
		}
	}
}

function initQueue(data) {
	if (data.queueComplete.length) {
		data.queueComplete.forEach(item => {
			addToQueue(data.queueList[item])
		})
	}
	if (data.currentItem) {
		addToQueue(data['queueList'][data.currentItem], true)
	}
	data.queue.forEach(item => {
		addToQueue(data.queueList[item])
	})
}

function startDownload(uuid) {
	$('#bar_' + uuid)
		.removeClass('indeterminate')
		.addClass('determinate')
}

socket.on('startDownload', startDownload)

function handleListClick(event) {
	if (!event.target.matches('.queue_icon[data-uuid]')) {
		return
	}

	let icon = event.target.innerText
	let uuid = $(event.target).data('uuid')

	switch (icon) {
		case 'remove':
			socket.emit('removeFromQueue', uuid)
			break
		default:
	}
}

// Show/Hide Download Tab
function toggleDownloadTab(ev) {
	ev.preventDefault()

	setTabWidth()

	tabContainerEl.style.transition = 'all 250ms ease-in-out'

	// Toggle returns a Boolean based on the action it performed
	let isHidden = tabContainerEl.classList.toggle('tab_hidden')

	if (!isHidden) {
		setTabWidth(cachedTabWidth)
	}

	localStorage.setItem('downloadTabOpen', !isHidden)
}

socket.on('init_downloadQueue', initQueue)
socket.on('addedToQueue', addToQueue)

function removeFromQueue(uuid) {
	let index = queue.indexOf(uuid)
	if (index > -1) {
		queue.splice(index, 1)
		$(`#download_${queueList[uuid].uuid}`).remove()
		delete queueList[uuid]
	}
}

socket.on('removedFromQueue', removeFromQueue)

function finishDownload(uuid) {
	if (queue.indexOf(uuid) > -1) {
		toast(`${queueList[uuid].title} finished downloading.`, 'done')
		$('#bar_' + uuid).css('width', '100%')
		let result_icon = $('#download_' + uuid).find('.queue_icon')
		if (queueList[uuid].failed == 0) {
			result_icon.text('done')
		} else if (queueList[uuid].failed >= queueList[uuid].size) {
			result_icon.text('error')
		} else {
			result_icon.text('warning')
		}
		let index = queue.indexOf(uuid)
		if (index > -1) {
			queue.splice(index, 1)
			queueComplete.push(uuid)
		}
		if (queue.length <= 0) {
			toast('All downloads completed!', 'done_all')
		}
	}
}

socket.on('finishDownload', finishDownload)

function removeAllDownloads(currentItem) {
	queueComplete = []
	if (currentItem == '') {
		queue = []
		queueList = {}
		$(listEl).html('')
	} else {
		queue = [currentItem]
		let tempQueueItem = queueList[currentItem]
		queueList = {}
		queueList[currentItem] = tempQueueItem
		$('.download_object').each(function (index) {
			if ($(this).attr('id') != 'download_' + currentItem) $(this).remove()
		})
	}
}

socket.on('removedAllDownloads', removeAllDownloads)

function removedFinishedDownloads() {
	queueComplete.forEach(item => {
		$('#download_' + item).remove()
	})
	queueComplete = []
}

socket.on('removedFinishedDownloads', removedFinishedDownloads)

function updateQueue(update) {
	if (update.uuid && queue.indexOf(update.uuid) > -1) {
		if (update.downloaded) {
			queueList[update.uuid].downloaded++
			$('#download_' + update.uuid + ' .queue_downloaded').text(
				queueList[update.uuid].downloaded + queueList[update.uuid].failed
			)
		}
		if (update.failed) {
			queueList[update.uuid].failed++
			$('#download_' + update.uuid + ' .queue_downloaded').text(
				queueList[update.uuid].downloaded + queueList[update.uuid].failed
			)
			if (queueList[update.uuid].failed == 1) {
				$('#download_' + update.uuid + ' .download_info_status').append(
					`<span class="secondary-text inline-flex"><span class="download_slim_separator">(</span><span class="queue_failed">1</span> <i class="material-icons">error_outline</i><span class="download_slim_separator">)</span></span>`
				)
			} else {
				$('#download_' + update.uuid + ' .queue_failed').text(queueList[update.uuid].failed)
			}
		}
		if (update.progress) {
			queueList[update.uuid].progress = update.progress
			$('#bar_' + update.uuid).css('width', update.progress + '%')
		}
	}
}

socket.on('updateQueue', updateQueue)

export default {
	init,
	sendAddToQueue,
	addToQueue
}
