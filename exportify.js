function print(label, obj) {
  console.log(label + JSON.stringify(obj, null, 2))
}

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
  apiCall(url, access_token) {
    let promise = fetch(url, { headers: { 'Authorization': 'Bearer ' + access_token} });
    return promise.then(response => {
      if (response.ok || response.status == 304) { print("response code", response.status); return response.json(); }
      else if (response.status == 401) { window.location = window.location.href.split('#')[0]; } // Return to home page after auth token expiry
      else if (response.status == 429) { $('#rateLimitMessage').show(); } // API Rate-limiting encountered
      else { alert(response.status); }
    });
  }
}

// The table of this user's playlists, to be displayed mid-page in the playlistsContainer
let PlaylistTable = React.createClass({
  // This is a sort of constructor to be used with new React classes that you're just creating
  // https://stackoverflow.com/questions/30668326/what-is-the-difference-between-using-constructor-vs-getinitialstate-in-react-r
  getInitialState() {
    return {
      playlists: [],
      playlistCount: 0,
      nextURL: null,
      prevURL: null
    };
  },

  // "componentDidMount() is invoked immediately after a component is mounted (inserted into the tree).
  // Initialization that requires DOM nodes should go here."
  componentDidMount() {
    this.loadPlaylists(this.props.url);
  }, 

  // Retrieve and display the list of user playlists. There are three steps: (1) retrieve data about the user,
  // (2) wait for it to come back, then use it to ask for the list of playlists, (3) wait for that to come back,
  // then parse that information out in to the React table.
  loadPlaylists(url) {
    let promise = utils.apiCall("https://api.spotify.com/v1/me", this.props.access_token);
    promise = promise.then(data => {
      return utils.apiCall("https://api.spotify.com/v1/users/" + data.id + "/playlists", this.props.access_token)
    });
    promise = promise.then(response => {
      if (this.isMounted()) {
        this.setState({
          playlists: response.items,
          playlistCount: response.total,
          nextURL: response.next,
          prevURL: response.previous
        });

        $('#playlists').fadeIn();
        $('#subtitle').text((response.offset + 1) + '-' +
          (response.offset + response.items.length) + ' of ' + response.total + ' playlists')
      }
    });
  },

  exportPlaylists() {
    PlaylistsExporter.export(this.props.access_token, this.state.playlistCount);
  },

  // This is the power of React. You get to use this "JSX Syntax" to define and configure html really easily.
  // {} are escape characters that demarcate javascript that needs to be evaluated to complete the html.
  // This is much like Jekyll's Liquid preprocessing engine.
  render() {
    return (
      <div id="playlists">
        <Paginator nextURL={this.state.nextURL} prevURL={this.state.prevURL} loadPlaylists={this.loadPlaylists}/>
        <table className="table table-hover">
          <thead>
            <tr>
              <th style={{width: "30px"}}></th>
              <th>Name</th>
              <th style={{width: "150px"}}>Owner</th>
              <th style={{width: "100px"}}>Tracks</th>
              <th style={{width: "120px"}}>Public?</th>
              <th style={{width: "120px"}}>Collaborative?</th>
              <th style={{width: "100px"}} className="text-right">
              <button className="btn btn-default btn-xs" type="submit" onClick={this.exportPlaylists}>
              <span className="fa fa-file-archive-o"></span> Export All</button></th>
            </tr>
          </thead>
          <tbody>
            {this.state.playlists.map((playlist, i) => {
              return <PlaylistRow playlist={playlist} access_token={this.props.access_token}/>;
            })}
          </tbody>
        </table>
        <Paginator nextURL={this.state.nextURL} prevURL={this.state.prevURL} loadPlaylists={this.loadPlaylists}/>
      </div>
    );
  }
});

// Separated out for convenience, I guess. The table's render method defines a bunch of these in a loop, which I'm
// guessing implicitly calls this thing's render method. 
let PlaylistRow = React.createClass({
  exportPlaylist() { // this is the function that gets called when an export button is pressed
    PlaylistExporter.export(this.props.access_token, this.props.playlist);
  },

  renderTickCross(dark) {
    if (dark) {
      return <i className="fa fa-lg fa-check-circle-o"></i>
    } else {
      return <i className="fa fa-lg fa-times-circle-o" style={{color: '#ECEBE8'}}></i>
    }
  },

  renderIcon(playlist) {
    return <i className="fa fa-music"></i>;
  },

  render() {
    p = this.props.playlist
    return ( // actual html for one row of the table
      <tr key={p.id}>
        <td>{this.renderIcon(p)}</td>
        <td><a href={p.uri}>{p.name}</a></td>
        <td><a href={p.owner.uri}>{p.owner.id}</a></td>
        <td>{p.tracks.total}</td>
        <td>{this.renderTickCross(p.public)}</td>
        <td>{this.renderTickCross(p.collaborative)}</td>
        <td className="text-right"><button className="btn btn-default btn-xs btn-success" type="submit"
          onClick={this.exportPlaylist}><span className="glyphicon glyphicon-save"></span> Export</button></td>
      </tr>
    );
  }
});

// For those users with a lot more playlists than necessary
let Paginator = React.createClass({
  nextClick(e) {
    e.preventDefault()
    if (this.props.nextURL != null) { this.props.loadPlaylists(this.props.nextURL); }
  },

  prevClick(e) {
    e.preventDefault()
    if (this.props.prevURL != null) { this.props.loadPlaylists(this.props.prevURL); }
  },

  render() {
    if (!this.props.nextURL && !this.props.prevURL) { return <div>&nbsp;</div> }
    else { return (
        <nav className="paginator text-right">
          <ul className="pagination pagination-sm">
            <li className={this.props.prevURL == null ? 'disabled' : ''}>
              <a href="#" aria-label="Previous" onClick={this.prevClick}>
                <span aria-hidden="true">&laquo;</span>
              </a>
            </li>
            <li className={this.props.nextURL == null ? 'disabled' : ''}>
              <a href="#" aria-label="Next" onClick={this.nextClick}>
                <span aria-hidden="true">&raquo;</span>
              </a>
            </li>
          </ul>
        </nav>
      ); }
  }
});

// Handles exporting all playlist data as a zip file
// Skipping Pavelizing for right now, but this thing is certainly much too long and probably broken after my other
// changes. Needs some attention, but I'm not as interested in this use case.
let PlaylistsExporter = {
  export(access_token, playlistCount) {
    let playlistFileNames = [];

    utils.apiCall("https://api.spotify.com/v1/me", access_token).then(function(response) {
      let limit = 20;
      let userId = response.id;

      // Initialize requests with starred playlist
      let requests = [
        utils.apiCall(
          "https://api.spotify.com/v1/users/" + userId + "/starred",
          access_token
        )
      ];

      // Add other playlists
      for (let offset = 0; offset < playlistCount; offset = offset + limit) {
        let url = "https://api.spotify.com/v1/users/" + userId + "/playlists";
        requests.push(
          utils.apiCall(url + '?offset=' + offset + '&limit=' + limit, access_token)
        )
      }

      $.when.apply($, requests).then(function() {
        let playlists = [];
        let playlistExports = [];

        // Handle either single or multiple responses
        if (typeof arguments[0].href == 'undefined') {
          $(arguments).each(function(i, response) {
            if (typeof response[0].items === 'undefined') {
              // Single playlist
              playlists.push(response[0]);
            } else {
              // Page of playlists
              $.merge(playlists, response[0].items);
            }
          })
        } else {
          playlists = arguments[0].items
        }

        $(playlists).each(function(i, playlist) {
          playlistFileNames.push(PlaylistExporter.fileName(playlist));
          playlistExports.push(PlaylistExporter.csvData(access_token, playlist));
        });

        return $.when.apply($, playlistExports);
      }).then(function() {
        let zip = new JSZip();
        let responses = [];

        $(arguments).each(function(i, response) {
          zip.file(playlistFileNames[i], response)
        });

        let content = zip.generate({ type: "blob" });
        saveAs(content, "spotify_playlists.zip");
      });
    });
  }
}

// Handles exporting a single playlist as a CSV file
let PlaylistExporter = {
  // Take the access token string and playlist object, generate a csv from it, and when that data is resolved and
  // returned save to a file.
  export(access_token, playlist) {
    let promise = this.csvData(access_token, playlist);
    let fileName = this.fileName(playlist);
    promise.then(data => { saveAs(new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8" }), fileName) });
  },

  // This is where the magic happens. The access token gives us permission to query this info from Spotify, and the
  // playlist object gives us all the information we need to start asking for songs.
  csvData(access_token, playlist) {
    // Make asynchronous API calls for 100 songs at a time, and put the results (all Promises) in a list.
    let requests = [];
    for (let offset = 0; offset < playlist.tracks.total; offset = offset + 100) {
      requests.push(utils.apiCall(playlist.tracks.href.split('?')[0] + '?offset=' + offset + '&limit=100',
          access_token));
    }
	
    // "returns a single Promise that resolves when all of the promises passed as an iterable have resolved"
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
    data_promise = Promise.all(requests).then(responses => {
      return responses.map(response => { // apply to all responses
        return response.items.map(song => { // appy to all songs in each response
          return [song.track.uri, '"'+song.track.name.replace(/"/g,'')+'"', '"'+song.track.album.name.replace(/"/g,'')+'"',
            song.track.duration_ms, song.track.popularity, song.track.release_date,
            '"'+song.track.artists.map(artist => { return artist.name }).join(', ')+'"',
            song.added_by.uri, song.added_at]
        });
      });
	});
    
    // label the columns and put in a single csv string
    return data_promise.then(data => {
      data = data.flat()
      data.unshift(["Spotify URI", "Track Name", "Album Name", "Duration (ms)",
        "Popularity", "Release Date", "Artist Name(s)", "Added By", "Added At"]);
        //"Genres"

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

// This is equivalento to jquery(document).ready(function() {...}). The function is a callback, called every time
// the page loads anew.
// https://api.jquery.com/ready/
$(function() {
  let [root, hash] = window.location.href.split('#')
  dict = {}
  if (hash) {
    let params = hash.split('&');
    for (let i = 0; i < params.length; i++) {
      let [k, v] = params[i].split('=');
      dict[k] = v;
    }
  }

  if (!dict.access_token) { // if we're on the home page
    $('#loginButton').css('display', 'inline-block')
  } else { // if we were just authorized and got a token
    // variable={value} makes that variable accessible to all React components via this.props.variable!
    React.render(<PlaylistTable access_token={dict.access_token} />, playlistsContainer);
    window.location = root + "#playlists"
  }
});
