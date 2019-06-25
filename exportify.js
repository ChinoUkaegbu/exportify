function print(label, obj) {
	console.log(label + JSON.stringify(obj, null, 2))
}

error = '<p><i class="fa fa-bolt" style="font-size: 50px; margin-bottom: 20px"></i></p><p>Exportify has encountered a <a target="_blank" href="https://developer.spotify.com/web-api/user-guide/#rate-limiting">rate limiting</a> error. Because I am interested in genre information, and genre lives in the artist JSON, I have to make server queries not only for the list of playlists and chunks of (100 at a time) songs from those lists, but also one call for each artist. If your music tastes are as variable as mine or you are trying to export too much at once, then the script will hit the ceiling pretty fast. But! the browser is actually caching those packets, so if you rerun the script (wait a minute and click the button again) a few times, it keeps filling in its missing pieces until it succeeds. Open developer tools with <tt>ctrl+shift+E</tt> and watch under the network tab to see this in action. Good luck.</p>';

// A collection of functions to create and send API queries
utils = {
	// Query the spotify server (by just setting the url) to let it know we want a session. This is literally
	// accomplished by navigating to this web address, where we may have to enter Spotify credentials, then
	// being redirected to the original website.
	// https://developer.spotify.com/documentation/general/guides/authorization-guide/
	authorize() {
		window.location = "https://accounts.spotify.com/authorize" +
			"?client_id=d99b082b01d74d61a100c9a0e056380b" +
			"&redirect_uri=" + encodeURIComponent([location.protocol, '//', location.host, location.pathname].join('')) +
			"&scope=playlist-read-private%20playlist-read-collaborative" +
			"&response_type=token";
	},

	// Make an asynchronous call to the server. Promises are *wierd*. Careful here! You have to call .json() on the
	// promise returned by the fetch to get a second promise that has the actual data in it!
	// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
	async apiCall(url, access_token, delay=0) {
		await new Promise(r => setTimeout(r, delay)); // JavaScript equivalent of sleep(delay)
		let promise = fetch(url, { headers: { 'Authorization': 'Bearer ' + access_token} });
		return promise.then(response => {
			if (response.ok) { return response.json();}
			else if (response.status == 401) { window.location = window.location.href.split('#')[0]; } // Return to home page after auth token expiry
			else if (response.status == 429) { rateLimitMessage.innerHTML = error; } // API Rate-limiting encountered
			else { alert(response.status); }
		});
	}
}

// The table of this user's playlists, to be displayed mid-page in the playlistsContainer
class PlaylistTable extends React.Component {
	// By default the constructor passes props to super. If you want some additional stuff, you have to override.
	// https://stackoverflow.com/questions/30668326/what-is-the-difference-between-using-constructor-vs-getinitialstate-in-react-r
	constructor(props) {
    super(props);
    this.state = { playlists: [], playlistCount: 0, nextURL: null, prevURL: null };
  }

	// "componentDidMount() is invoked immediately after a component is mounted (inserted into the tree).
	// Initialization that requires DOM nodes should go here."
	componentDidMount() {
		this.loadPlaylists(this.props.url);
	} 

	// Retrieve and display the list of user playlists. There are three steps: (1) retrieve data about the user,
	// (2) wait for it to come back, then use it to ask for the list of playlists, (3) wait for that to come back,
	// then parse that information out in to the React table.
	loadPlaylists(url) {
		let promise = utils.apiCall("https://api.spotify.com/v1/me", this.props.access_token);
		promise = promise.then(data => {
			return utils.apiCall("https://api.spotify.com/v1/users/" + data.id + "/playlists", this.props.access_token)
		});
		promise.then(response => {
				this.setState({ playlists: response.items, playlistCount: response.total, nextURL: response.next,
					prevURL: response.previous });

				playlists.style.display = 'block';
				subtitle.textContent = (response.offset + 1) + '-' +
					(response.offset + response.items.length) + ' of ' + response.total + ' playlists\n';
				instr.textContent = "The script is rate limited to 10 API calls per second, so for large playlists it takes a "
					+ "few minutes to run. Just click once and wait."
			});
	}

	exportPlaylists() {
		ZipExporter.export(this.props.access_token, this.state.playlists);
	}

	// There used to be JSX syntax in here, but JSX was abandoned by the React community because Babel does it better.
	// Around the web there seems to be a movement to not use this syntax if possible, because it means you literally
	// have to pass this .js file through a transformer to get pure JavaScript, which slows down page loading significantly.
	render() {
		return React.createElement("div", { id: "playlists" },
			React.createElement(Paginator, { nextURL: this.state.nextURL, prevURL: this.state.prevURL,
																			loadPlaylists: this.loadPlaylists }),
			React.createElement("table", { className: "table table-hover" },
				React.createElement("thead", null,
					React.createElement("tr", null,
						React.createElement("th", { style: { width: "30px" }}),
						React.createElement("th", null, "Name"),
						React.createElement("th", { style: { width: "150px" } }, "Owner"),
						React.createElement("th", { style: { width: "100px" } }, "Tracks"),
						React.createElement("th", { style: { width: "120px" } }, "Public?"),
						React.createElement("th", { style: { width: "120px" } }, "Collaborative?"),
						React.createElement("th", { style: { width: "100px" }, className: "text-right"},
							React.createElement("button", { className: "btn btn-default btn-xs", type: "submit", onClick: this.exportPlaylists.bind(this) },
								React.createElement("i", { className: "fa fa-file-archive-o"}), " Export All")))),
				React.createElement("tbody", null, this.state.playlists.map((playlist, i) => {
					return React.createElement(PlaylistRow, { playlist: playlist, access_token: this.props.access_token, row: i});
				}))),
			React.createElement(Paginator, { nextURL: this.state.nextURL, prevURL: this.state.prevURL,
																			loadPlaylists: this.loadPlaylists }));
		}
}

// Separated out for convenience, I guess. The table's render method defines a bunch of these in a loop, which I'm
// guessing implicitly calls this thing's render method. 
class PlaylistRow extends React.Component {
 	exportPlaylist() { // this is the function that gets called when an export button is pressed
		PlaylistExporter.export(this.props.access_token, this.props.playlist, this.props.row);
	}

	renderTickCross(dark) {
		if (dark) {
			return React.createElement("i", { className: "fa fa-lg fa-check-circle-o" });
		} else {
			return React.createElement("i", { className: "fa fa-lg fa-times-circle-o", style: { color: '#ECEBE8' } });
		}
	}

	renderIcon(playlist) {
		return React.createElement("i", { className: "fa fa-music" });
	}

	render() {
		let p = this.props.playlist
		return React.createElement("tr", { key: p.id },
			React.createElement("td", null, this.renderIcon(p)),
				React.createElement("td", null,
					React.createElement("a", { href: p.external_urls.spotify }, p.name)),
				React.createElement("td", null,
					React.createElement("a", { href: p.owner.external_urls.spotify }, p.owner.id)),
				React.createElement("td", null, p.tracks.total),
				React.createElement("td", null, this.renderTickCross(p.public)),
				React.createElement("td", null, this.renderTickCross(p.collaborative)),
				React.createElement("td", { className: "text-right" },
					React.createElement("button", { className: "btn btn-default btn-xs btn-success", type: "submit",
  																				id: "export" + this.props.row, onClick: this.exportPlaylist.bind(this) },
						React.createElement("i", { className: "fa fa-download" }), " Export")));
	}
}

// For those users with a lot more playlists than necessary
class Paginator extends React.Component {
	nextClick(e) {
		e.preventDefault()
		if (this.props.nextURL != null) { this.props.loadPlaylists(this.props.nextURL); }
		print("next", null);
	}

	prevClick(e) {
		e.preventDefault()
		if (this.props.prevURL != null) { this.props.loadPlaylists(this.props.prevURL); }
		print("prev", null);
	}

	render() {
		if (!this.props.nextURL && !this.props.prevURL) { return React.createElement("div", null, "\xA0"); }
		else { return React.createElement("nav", { className: "paginator text-right" },
			React.createElement("ul", { className: "pagination pagination-sm" },
				React.createElement("li", { className: this.props.prevURL == null ? 'disabled' : '' },
					React.createElement("a", { href: "#", "aria-label": "Previous", onClick: this.prevClick.bind(this) },
						React.createElement("span", { "aria-hidden": "true" }, "\xAB"))),
				React.createElement("li", { className: this.props.nextURL == null ? 'disabled' : '' },
					React.createElement("a", { href: "#", "aria-label": "Next", onClick: this.nextClick.bind(this) },
						React.createElement("span", { "aria-hidden": "true" }, "\xBB")))));
		}
	};
}

// Handles exporting all playlist data as a zip file
let ZipExporter = {
	export(access_token, playlists) {
		let csv_promises = playlists.map(playlist => PlaylistExporter.csvData(access_token, playlist));
		let fileNames = playlists.map(playlist => PlaylistExporter.fileName(playlist));

		Promise.all(csv_promises).then(csvs => {
			let zip = new JSZip();
			csvs.forEach((csv, i) => { zip.file(fileNames[i], csv); });
			let content = zip.generate({ type: "blob" });
			saveAs(content, "spotify_playlists.zip");
		});
	}
}

// Handles exporting a single playlist as a CSV file
let PlaylistExporter = {
	// Take the access token string and playlist object, generate a csv from it, and when that data is resolved and
	// returned save to a file.
	export(access_token, playlist, row) {
		document.getElementById("export"+row).innerHTML = '<i class="fa fa-circle-o-notch fa-spin"></i> Exporting';
		let promise = this.csvData(access_token, playlist);
		let fileName = this.fileName(playlist);
		promise.then(data => { document.getElementById("export"+row).innerHTML = '<i class="fa fa-download"></i> Export';
			saveAs(new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8" }), fileName) });
	},

	// This is where the magic happens. The access token gives us permission to query this info from Spotify, and the
	// playlist object gives us all the information we need to start asking for songs.
	csvData(access_token, playlist) {
		// Make asynchronous API calls for 100 songs at a time, and put the results (all Promises) in a list.
		let requests = [];
		for (let offset = 0; offset < playlist.tracks.total; offset = offset + 100) {
			requests.push(utils.apiCall(playlist.tracks.href.split('?')[0] + '?offset=' + offset + '&limit=100',
					access_token, offset));
		}
	
		// "returns a single Promise that resolves when all of the promises passed as an iterable have resolved"
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
		let artist_hrefs = new Set();
		let data_promise = Promise.all(requests).then(responses => {
			return responses.map(response => { // apply to all responses
				return response.items.map(song => { // appy to all songs in each response
					song.track.artists.forEach(a => { artist_hrefs.add(a.href) });
					return [song.track.uri, '"'+song.track.name.replace(/"/g,'')+'"', '"'+song.track.album.name.replace(/"/g,'')+'"',
						song.track.duration_ms, song.track.popularity, song.track.album.release_date,
						'"'+song.track.artists.map(artist => { return artist.name }).join(',')+'"',
						song.added_by.uri, song.added_at]
				});
			});
		});

		// Make queries on all the artists, because this json is where genre information lives. Unfortunately this
		// means a second wave of traffic.
		let genre_promise = data_promise.then(() => {
			let artists_promises = Array.from(artist_hrefs).map((href, i) => utils.apiCall(href, access_token, 100*i));
			return Promise.all(artists_promises).then(responses => {
			  let artist_genres = {};
			  responses.forEach(artist => { artist_genres[artist.name] = artist.genres.join(','); });
			  return artist_genres;
			});
		});

		// join genres to the table, label the columns, and put all data in a single csv string
		return Promise.all([data_promise, genre_promise]).then(values => {
			[data, artist_genres] = values;

			data = data.flat();
			data.forEach(row => {
				artists = row[6].substring(1, row[6].length-1).split(','); // strip the quotes
				deduplicated_genres = new Set(artists.map(a => artist_genres[a]).join(",").split(",")); // in case multiple artists
				row.push('"'+Array.from(deduplicated_genres).filter(x => x != "").join(",")+'"'); // remove empty strings
			});
			data.unshift(["Spotify URI", "Track Name", "Album Name", "Duration (ms)",
				"Popularity", "Release Date", "Artist Name(s)", "Added By", "Added At", "Genres"]);

			csv = '';
			data.forEach(row => { csv += row.join(",") + "\n" });
			return csv;
		});
	},

	// take the playlist object and return an acceptable filename
	fileName(playlist) {
		return playlist.name.replace(/[^a-z0-9\- ]/gi, '').replace(/[ ]/gi, '_').toLowerCase() + ".csv";
	}
}

// runs when the page loads
window.onload = () => {
	let [root, hash] = window.location.href.split('#');
	dict = {};
	if (hash) {
		let params = hash.split('&');
		for (let i = 0; i < params.length; i++) {
			let [k, v] = params[i].split('=');
			dict[k] = v;
		}
	}

	if (dict.access_token) { // if we were just authorized and got a token
		loginButton.style.display = 'none';
		ReactDOM.render(React.createElement(PlaylistTable, { access_token: dict.access_token }), playlistsContainer);
		window.location = root + "#playlists"
	}
}
