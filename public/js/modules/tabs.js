import ArtistTab from './components/artist-tab.js'
import TracklistTab from './components/tracklist-tab.js'
import LinkAnalyzerTab from './components/link-analyzer-tab.js'
import HomeTab from './components/home-tab.js'
import ChartsTab from './components/charts-tab.js'
import FavoritesTab from './components/favorites-tab.js'
import { socket } from './socket.js'
import SettingsTab from './components/settings-tab.js'
import MainSearch from './components/main-search.js'
import TrackPreview from './track-preview.js'

/* ===== Globals ====== */
window.search_selected = ''
window.main_selected = ''
window.windows_stack = []

/* ===== Locals ===== */
let currentStack = {}

// Exporting this function out of the default export
// because it's used in components that are needed
// in this file too
export function artistView(ev) {
	let id = ev.currentTarget.dataset.id
	ArtistTab.reset()
	socket.emit('getTracklist', { type: 'artist', id: id })
	showTab('artist', id)
}

// Exporting this function out of the default export
// because it's used in components that are needed
// in this file too
export function albumView(ev) {
	let id = ev.currentTarget.dataset.id
	TracklistTab.reset()
	socket.emit('getTracklist', { type: 'album', id: id })
	showTab('album', id)
}

// Exporting this function out of the default export
// because it's used in components that are needed
// in this file too
export function playlistView(ev) {
	let id = ev.currentTarget.dataset.id
	TracklistTab.reset()
	socket.emit('getTracklist', { type: 'playlist', id: id })
	showTab('playlist', id)
}

export function spotifyPlaylistView(ev) {
	let id = ev.currentTarget.dataset.id
	TracklistTab.reset()
	socket.emit('getTracklist', { type: 'spotifyplaylist', id: id })
	showTab('spotifyplaylist', id)
}

function analyzeLink(link) {
	console.log('Analyzing: ' + link)
	LinkAnalyzerTab.reset()
	socket.emit('analyzeLink', link)
}

function linkListeners() {
	document.getElementById('search_tab').addEventListener('click', handleSearchTabClick)
	document.getElementById('favorites_tab').addEventListener('click', handleFavoritesTabClick)
	document.getElementById('sidebar').addEventListener('click', handleSidebarClick)

	const backButtons = Array.from(document.getElementsByClassName('back-button'))

	backButtons.forEach(button => {
		button.addEventListener('click', backTab)
	})
}

/**
 * Handles click Event on the sidebar and changes tab
 * according to clicked icon.
 * Uses event delegation
 * @param		{Event}		event
 * @since		0.1.0
 */
function handleSidebarClick(event) {
	if (!(event.target.matches('.main_tablinks') || event.target.parentElement.matches('.main_tablinks'))) {
		return
	}

	let sidebarEl = event.target.matches('.main_tablinks') ? event.target : event.target.parentElement
	let targetID = sidebarEl.getAttribute('id')

	switch (targetID) {
		case 'main_search_tablink':
			changeTab(sidebarEl, 'main', 'search_tab')
			break
		case 'main_home_tablink':
			changeTab(sidebarEl, 'main', 'home_tab')
			break
		case 'main_charts_tablink':
			changeTab(sidebarEl, 'main', 'charts_tab')
			break
		case 'main_favorites_tablink':
			changeTab(sidebarEl, 'main', 'favorites_tab')
			break
		case 'main_analyzer_tablink':
			changeTab(sidebarEl, 'main', 'analyzer_tab')
			break
		case 'main_settings_tablink':
			changeTab(sidebarEl, 'main', 'settings_tab')
			break
		case 'main_about_tablink':
			changeTab(sidebarEl, 'main', 'about_tab')
			break

		default:
			break
	}
}

function handleSearchTabClick(event) {
	let targetID = event.target.id

	switch (targetID) {
		case 'search_all_tab':
			changeTab(event.target, 'search', 'main_search')
			break
		case 'search_track_tab':
			changeTab(event.target, 'search', 'track_search')
			break
		case 'search_album_tab':
			changeTab(event.target, 'search', 'album_search')
			break
		case 'search_artist_tab':
			changeTab(event.target, 'search', 'artist_search')
			break
		case 'search_playlist_tab':
			changeTab(event.target, 'search', 'playlist_search')
			break

		default:
			break
	}
}

function handleFavoritesTabClick(event) {
	let targetID = event.target.id

	switch (targetID) {
		case 'favorites_playlist_tab':
			changeTab(event.target, 'favorites', 'playlist_favorites')
			break
		case 'favorites_album_tab':
			changeTab(event.target, 'favorites', 'album_favorites')
			break
		case 'favorites_artist_tab':
			changeTab(event.target, 'favorites', 'artist_favorites')
			break
		case 'favorites_track_tab':
			changeTab(event.target, 'favorites', 'track_favorites')
			break

		default:
			break
	}
}

function changeTab(sidebarEl, section, tabName) {
	windows_stack = []
	currentStack = {}
	var i, tabcontent, tablinks
	tabcontent = document.getElementsByClassName(section + '_tabcontent')
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = 'none'
	}
	tablinks = document.getElementsByClassName(section + '_tablinks')
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].classList.remove('active')
	}
	if (tabName == 'settings_tab' && main_selected != 'settings_tab') {
		SettingsTab.settings = { ...SettingsTab.lastSettings }
		SettingsTab.spotifyCredentials = { ...SettingsTab.lastCredentials }
		SettingsTab.spotifyUser = (' ' + SettingsTab.lastUser).slice(1)
	}

	document.getElementById(tabName).style.display = 'block'

	if ('main' === section) {
		main_selected = tabName
	} else if ('search' === section) {
		search_selected = tabName
	}

	// Not choosing .currentTarget beacuse the event
	// is delegated
	sidebarEl.classList.add('active')

	// Check if you need to load more content in the search tab
	if (
		main_selected == 'search_tab' &&
		['track_search', 'album_search', 'artist_search', 'playlist_search'].indexOf(search_selected) != -1 &&
		MainSearch.results[search_selected.split('_')[0] + 'Tab'].data.length == 0
	) {
		MainSearch.search(search_selected.split('_')[0])
	}
}

function showTab(type, id, back = false) {
	if (windows_stack.length == 0) {
		windows_stack.push({ tab: main_selected })
	} else if (!back) {
		windows_stack.push(currentStack)
	}

	window.tab = type == 'artist' ? 'artist_tab' : 'tracklist_tab'

	currentStack = { type: type, id: id }
	let tabcontent = document.getElementsByClassName('main_tabcontent')

	for (let i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = 'none'
	}
	document.getElementById(tab).style.display = 'block'
	TrackPreview.stopStackedTabsPreview()
}

function backTab() {
	if (windows_stack.length == 1) {
		document.getElementById(`main_${main_selected}link`).click()
	} else {
		let tabObj = windows_stack.pop()
		if (tabObj.type == 'artist') {
			ArtistTab.reset()
		} else {
			TracklistTab.reset()
		}
		socket.emit('getTracklist', { type: tabObj.type, id: tabObj.id })
		showTab(tabObj.type, tabObj.id, true)
	}
	TrackPreview.stopStackedTabsPreview()
}

export default {
	linkListeners,
	artistView,
	albumView,
	playlistView,
	analyzeLink
}
