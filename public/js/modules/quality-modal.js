import Downloads from './downloads.js'

const QualityModal = {
	// Defaults
	open: false,
	url: ''
}

function init() {
	QualityModal.element = document.getElementById('modal_quality')

	linkListeners()
}

function open(link) {
	QualityModal.url = link
	QualityModal.element.style.display = 'block'
	QualityModal.element.classList.add('animated', 'fadeIn')
}

function linkListeners() {
	QualityModal.element.addEventListener('click', handleClick)
	QualityModal.element.addEventListener('webkitAnimationEnd', handleAnimationEnd)
}

function handleClick(event) {
	QualityModal.element.classList.add('animated', 'fadeOut')

	if (!event.target.matches('.quality-button')) {
		return
	}

	let bitrate = event.target.dataset.qualityValue

	Downloads.sendAddToQueue(QualityModal.url, bitrate)
}

function handleAnimationEnd() {
	QualityModal.element.classList.remove('animated', QualityModal.open ? 'fadeOut' : 'fadeIn')
	QualityModal.element.style.display = QualityModal.open ? 'none' : 'block'
	QualityModal.open = !QualityModal.open
}

export default {
	init,
	open
}
