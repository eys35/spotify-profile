"use strict";
const clientId = 'e618a564d7d8442b83b349085a0d3e16'; // Replace with your actual Spotify Client ID
const redirectUri = 'https://d3sovm61morlqo.cloudfront.net';
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded and parsed");
    if (!window.isSecureContext) {
        console.error("Web Crypto API requires a secure context (HTTPS).");
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
        console.log("Login button found");
        loginButton.addEventListener("click", () => {
            console.log("Login button clicked");
            redirectToAuthCodeFlow(clientId);
        });
    }
    else {
        console.error("Login button not found");
    }
    if (code) {
        console.log("Authorization code found: ", code);
        getAccessToken(clientId, code).then(accessToken => {
            console.log("Access Token:", accessToken);
            sessionStorage.setItem("accessToken", accessToken);
            fetchProfile(accessToken).then(profile => {
                populateUI(profile);
                setupEventListeners(accessToken);
            }).catch(error => {
                console.error("Error fetching profile:", error);
                alert("Error fetching profile: " + error.message);
            });
        }).catch(error => {
            console.error("Error getting access token:", error);
            alert("Error getting access token: " + error.message);
        });
    }
    else {
        const accessToken = sessionStorage.getItem("accessToken");
        if (accessToken) {
            fetchProfile(accessToken).then(profile => {
                populateUI(profile);
                setupEventListeners(accessToken);
            }).catch(error => {
                console.error("Error fetching profile:", error);
                alert("Error fetching profile: " + error.message);
            });
        }
    }
});
async function redirectToAuthCodeFlow(clientId) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem("verifier", verifier);
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", redirectUri);
    params.append("scope", "user-read-private user-read-email user-library-read user-top-read playlist-read-private playlist-read-collaborative");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);
    console.log("Redirecting to Spotify authorization");
    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}
function generateCodeVerifier(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
async function generateCodeChallenge(codeVerifier) {
    console.log("Generating code challenge for verifier:", codeVerifier);
    const data = new TextEncoder().encode(codeVerifier);
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error("Web Crypto API is not supported in this browser.");
    }
    try {
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
    catch (error) {
        console.error("Error generating code challenge:", error);
        throw error;
    }
}
async function getAccessToken(clientId, code) {
    const verifier = sessionStorage.getItem("verifier");
    if (!verifier) {
        throw new Error("No code verifier found in sessionStorage");
    }
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("code_verifier", verifier);
    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });
    const data = await result.json();
    if (data.error) {
        throw new Error(data.error_description);
    }
    return data.access_token;
}
async function fetchProfile(token) {
    try {
        const result = await fetch("https://api.spotify.com/v1/me", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (result.status === 403) {
            throw new Error("Access forbidden. Check your scopes and permissions.");
        }
        const profile = await result.json();
        return profile;
    }
    catch (error) {
        console.error("Error fetching profile:", error);
        throw error;
    }
}
// function populateUI(profile: any) {
//   document.getElementById("displayName")!.innerText = profile.display_name;
//   if (profile.images[0]) {
//     const profileImage = new Image(100, 100);
//     profileImage.src = profile.images[0].url;
//     document.getElementById("avatar")!.appendChild(profileImage);
//   }
//   document.getElementById("id")!.innerText = profile.id;
//   document.getElementById("email")!.innerText = profile.email;
//   document.getElementById("uri")!.innerText = profile.uri;
//   document.getElementById("uri")!.setAttribute("href", profile.external_urls.spotify);
//   document.getElementById("url")!.innerText = profile.href;
//   document.getElementById("url")!.setAttribute("href", profile.href);
//   document.getElementById("imgUrl")!.innerText = profile.images[0]?.url ?? '(no profile image)';
// }
function populateUI(profile) {
    const displayNameElement = document.getElementById("displayName");
    if (displayNameElement) {
        displayNameElement.innerText = profile.display_name;
    }
    else {
        console.error("Element with ID 'displayName' not found.");
    }
    // document.body.classList.add("logged-in");
}
function setupEventListeners(accessToken) {
    const searchButton = document.getElementById("searchButton");
    if (searchButton) {
        searchButton.addEventListener("click", () => searchTrack(accessToken));
    }
    const applyOptionsButton = document.getElementById("applyOptionsButton");
    if (applyOptionsButton) {
        applyOptionsButton.addEventListener("click", () => {
            const selectedTrackId = document.getElementById("trackDetails").dataset.trackId;
            if (selectedTrackId) {
                fetchTrackAudioFeatures(selectedTrackId, accessToken, true);
            }
        });
    }
}
async function searchTrack(token) {
    const queryElement = document.getElementById("searchQuery");
    if (queryElement) {
        const query = queryElement.value;
        const result = await fetch(`https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await result.json();
        displaySearchResults(data.tracks.items, token);
    }
}
function displaySearchResults(tracks, token) {
    const searchResults = document.getElementById("searchResults");
    if (searchResults) {
        searchResults.innerHTML = '';
        tracks.forEach(track => {
            const trackElement = document.createElement("div");
            trackElement.innerText = `${track.name} by ${track.artists.map((artist) => artist.name).join(", ")}`;
            trackElement.style.cursor = "pointer"; // Indicate that the item is clickable
            trackElement.addEventListener("click", () => {
                displayTrackDetails(track);
                fetchTrackAudioFeatures(track.id, token, false);
            });
            searchResults.appendChild(trackElement);
        });
    }
}
async function fetchTrackAudioFeatures(trackId, token, applyOptions) {
    try {
        const result = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await result.json();
        displayTrackAudioFeatures(data);
        fetchRecommendations(data, token, applyOptions); // Fetch recommendations based on track features
    }
    catch (error) {
        console.error("Error fetching audio features:", error);
    }
}
function displayTrackDetails(track) {
    document.getElementById("trackName").innerText = track.name;
    document.getElementById("artistName").innerText = track.artists[0].name;
    document.getElementById("albumName").innerText = track.album.name;
    const albumImage = document.getElementById("albumImage");
    if (albumImage) {
        albumImage.src = track.album.images[0].url;
    }
    const trackPreview = document.getElementById("trackPreview");
    if (trackPreview) {
        trackPreview.src = track.preview_url;
    }
    document.getElementById("trackDetails").dataset.trackId = track.id; // Store track ID
}
function translateKey(key) {
    const keys = [
        "C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G",
        "G♯/A♭", "A", "A♯/B♭", "B"
    ];
    return key >= 0 && key < keys.length ? keys[key] : "Unknown";
}
function translateMode(mode) {
    return mode === 1 ? "Major" : mode === 0 ? "Minor" : "Unknown";
}
function displayTrackAudioFeatures(features) {
    const featuresElement = document.getElementById("trackFeatures");
    if (featuresElement) {
        featuresElement.innerHTML = `
      <p><strong>danceability:</strong> ${features.danceability ?? 'N/A'}</p>
      <p><strong>energy:</strong> ${features.energy ?? 'N/A'}</p>
      <p><strong>tempo:</strong> ${features.tempo ?? 'N/A'}</p>
      <p><strong>valence:</strong> ${features.valence ?? 'N/A'}</p>
      <p><strong>speechiness:</strong> ${features.speechiness ?? 'N/A'}</p>
      <p><strong>acousticness:</strong> ${features.acousticness ?? 'N/A'}</p>
      <p><strong>instrumentalness:</strong> ${features.instrumentalness ?? 'N/A'}</p>
      <p><strong>liveness:</strong> ${features.liveness ?? 'N/A'}</p>
      <p><strong>loudness:</strong> ${features.loudness ?? 'N/A'}</p>
      <p><strong>key:</strong> ${translateKey(features.key)}</p>
      <p><strong>mode:</strong> ${translateMode(features.mode)}</p>
      <p><strong>time signature:</strong> ${features.time_signature ?? 'N/A'}</p>
      <p><strong>duration:</strong> ${features.duration_ms ?? 'N/A'}</p>
    `;
    }
}
function getSelectedOptions() {
    const optionsForm = document.getElementById("optionsForm");
    const formData = new FormData(optionsForm);
    const selectedOptions = {};
    formData.forEach((_value, key) => {
        selectedOptions[key] = true;
    });
    return selectedOptions;
}
async function fetchRecommendations(features, token, applyOptions) {
    try {
        const numRecommendationsElement = document.getElementById("numRecommendations");
        const numRecommendations = numRecommendationsElement ? parseInt(numRecommendationsElement.value) : 10;
        const params = new URLSearchParams({
            limit: numRecommendations.toString(),
            seed_tracks: features.id
        });
        if (applyOptions) {
            const selectedOptions = getSelectedOptions();
            if (selectedOptions.danceability) {
                params.append('target_danceability', features.danceability);
            }
            if (selectedOptions.energy) {
                params.append('target_energy', features.energy);
            }
            if (selectedOptions.key) {
                params.append('target_key', features.key);
            }
            if (selectedOptions.mode) {
                params.append('target_mode', features.mode);
            }
            if (selectedOptions.tempo) {
                params.append('target_tempo', features.tempo);
            }
        }
        const result = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await result.json();
        await displayRecommendations(data.tracks, token);
    }
    catch (error) {
        console.error("Error fetching recommendations:", error);
    }
}
async function displayRecommendations(tracks, token) {
    const recommendationsElement = document.getElementById("recommendations");
    if (recommendationsElement) {
        recommendationsElement.innerHTML = '<h2>recommended tracks</h2>';
        for (const track of tracks) {
            const trackElement = document.createElement("div");
            trackElement.className = "track";
            const albumImage = track.album.images[0]?.url ? `<img src="${track.album.images[0].url}" alt="Album cover">` : '';
            const audioPlayer = track.preview_url ? `<audio controls src="${track.preview_url}"></audio>` : '';
            const detailsHTML = `
        <div class="details">
          <p><a href="${track.external_urls.spotify}" target="_blank"><strong>${track.name}</strong></a> by ${track.artists.map((artist) => artist.name).join(", ")}</p>
          <p><strong>album:</strong> ${track.album.name}</p>
          <p><strong>tempo (bpm):</strong> ${await fetchTrackFeature(track.id, token, 'tempo')}</p>
          <p><strong>danceability:</strong> ${await fetchTrackFeature(track.id, token, 'danceability')}</p>
          <p><strong>energy:</strong> ${await fetchTrackFeature(track.id, token, 'energy')}</p>
          <p><strong>key:</strong> ${translateKey(await fetchTrackFeature(track.id, token, 'key'))}</p>
        </div>
      `;
            trackElement.innerHTML = `
        ${detailsHTML}
        <div class="audio-album">
          ${audioPlayer}
          <div class="album">${albumImage}</div>
        </div>
      `;
            recommendationsElement.appendChild(trackElement);
        }
    }
}
async function fetchTrackFeature(trackId, token, feature) {
    const result = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await result.json();
    return data[feature];
}
//# sourceMappingURL=script.js.map