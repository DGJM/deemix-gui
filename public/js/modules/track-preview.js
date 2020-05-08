/* ===== Globals ====== */
window.preview_max_volume = 1

/* ===== Locals ===== */
let preview_track = document.getElementById('preview-track')
let preview_stopped = true

// init stuff
function init() {
	preview_track.volume = 1
	/*preview_max_volume = parseFloat(localStorage.getItem("previewVolume"))
  if (preview_max_volume === null){
    preview_max_volume = 0.8
    localStorage.setItem("previewVolume", preview_max_volume)
  }*/

	// start playing when track loaded
	preview_track.addEventListener('canplay', function () {
		preview_track.play()
		preview_stopped = false
		$(preview_track).animate({ volume: preview_max_volume }, 500)
	})

	// auto fadeout when at the end of the song
	preview_track.addEventListener('timeupdate', function () {
		if (preview_track.currentTime > preview_track.duration - 1) {
			$(preview_track).animate({ volume: 0 }, 800)
			preview_stopped = true
			$('a[playing] > .preview_controls').css({ opacity: 0 })
			$('*').removeAttr('playing')
			$('.preview_controls').text('play_arrow')
			$('.preview_playlist_controls').text('play_arrow')
		}
	})
}

// on modal closing
function stopStackedTabsPreview() {
	if (
		$('.preview_playlist_controls').filter(function () {
			return $(this).attr('playing')
		}).length > 0
	) {
		$(preview_track).animate({ volume: 0 }, 800)
		preview_stopped = true
		$('.preview_playlist_controls').removeAttr('playing')
		$('.preview_playlist_controls').text('play_arrow')
	}
}

// on hover event
function previewMouseEnter(e) {
	$(e.currentTarget).css({ opacity: 1 })
}

function previewMouseLeave(e) {
	let obj = e.currentTarget
	if (($(obj).parent().attr('playing') && preview_stopped) || !$(obj).parent().attr('playing')) {
		$(obj).css({ opacity: 0 }, 200)
	}
}

// on click event
function playPausePreview(e) {
	e.preventDefault()
	let obj = e.currentTarget
	var icon = obj.tagName == 'I' ? $(obj) : $(obj).children('i')
	if ($(obj).attr('playing')) {
		if (preview_track.paused) {
			preview_track.play()
			preview_stopped = false
			icon.text('pause')
			$(preview_track).animate({ volume: preview_max_volume }, 500)
		} else {
			preview_stopped = true
			icon.text('play_arrow')
			$(preview_track).animate({ volume: 0 }, 250, 'swing', () => {
				preview_track.pause()
			})
		}
	} else {
		$('*').removeAttr('playing')
		$(obj).attr('playing', true)
		$('.preview_controls').text('play_arrow')
		$('.preview_playlist_controls').text('play_arrow')
		$('.preview_controls').css({ opacity: 0 })
		icon.text('pause')
		icon.css({ opacity: 1 })
		preview_stopped = false
		$(preview_track).animate({ volume: 0 }, 250, 'swing', () => {
			preview_track.pause()
			$('#preview-track_source').prop('src', $(obj).data('preview'))
			preview_track.load()
		})
	}
}

export default {
	init,
	stopStackedTabsPreview,
	previewMouseEnter,
	previewMouseLeave,
	playPausePreview
}
