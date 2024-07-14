const clientId = "e618a564d7d8442b83b349085a0d3e16"; // Replace with your client id
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

if (!code) {
  redirectToAuthCodeFlow(clientId);
} else {
  const accessToken = await getAccessToken(clientId, code);
  const profile = await fetchProfile(accessToken);
  populateUI(profile);

  const searchButton = document.getElementById("searchButton");
  if (searchButton) {
    searchButton.addEventListener("click", () => searchTrack(accessToken));
  }
}

export async function redirectToAuthCodeFlow(clientId: string) {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  params.append("redirect_uri", "http://localhost:5173/callback");
  params.append("scope", "user-read-private user-read-email");
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length: number) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function getAccessToken(clientId: string, code: string): Promise<string> {
  const verifier = localStorage.getItem("verifier");

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", "http://localhost:5173/callback");
  params.append("code_verifier", verifier!);

  const result = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const { access_token } = await result.json();
  localStorage.setItem("access_token", access_token);
  return access_token;
}

async function fetchProfile(token: string): Promise<any> {
  const result = await fetch("https://api.spotify.com/v1/me", {
    method: "GET", headers: { Authorization: `Bearer ${token}` }
  });

  return await result.json();
}

function populateUI(profile: any) {
  document.getElementById("displayName")!.innerText = profile.display_name;
  if (profile.images[0]) {
    const profileImage = new Image(200, 200);
    profileImage.src = profile.images[0].url;
    document.getElementById("avatar")!.appendChild(profileImage);
  }
  document.getElementById("id")!.innerText = profile.id;
  document.getElementById("email")!.innerText = profile.email;
  document.getElementById("uri")!.innerText = profile.uri;
  document.getElementById("uri")!.setAttribute("href", profile.external_urls.spotify);
  document.getElementById("url")!.innerText = profile.href;
  document.getElementById("url")!.setAttribute("href", profile.href);
  document.getElementById("imgUrl")!.innerText = profile.images[0]?.url ?? '(no profile image)';
}

async function searchTrack(token: string) {
  const queryElement = document.getElementById("searchQuery") as HTMLInputElement;
  if (queryElement) {
    const query = queryElement.value;
    const result = await fetch(`https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    const data = await result.json();
    displaySearchResults(data.tracks.items, token);
  }
}

function displaySearchResults(tracks: any[], token: string) {
  const searchResults = document.getElementById("searchResults");
  if (searchResults) {
    searchResults.innerHTML = '';
    tracks.forEach(track => {
      const trackElement = document.createElement("div");
      trackElement.innerText = `${track.name} by ${track.artists.map((artist: any) => artist.name).join(", ")}`;
      trackElement.style.cursor = "pointer"; // Indicate that the item is clickable
      trackElement.addEventListener("click", () => {
        displayTrackDetails(track);
        fetchTrackAudioFeatures(track.id, token);
      });
      searchResults.appendChild(trackElement);
    });
  }
}

async function fetchTrackAudioFeatures(trackId: string, token: string) {
  try {
    const result = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    const data = await result.json();
    displayTrackAudioFeatures(data);
  } catch (error) {
    console.error("Error fetching audio features:", error);
  }
}

function displayTrackDetails(track: any) {
  document.getElementById("trackName")!.innerText = track.name;
  document.getElementById("artistName")!.innerText = track.artists[0].name;
  document.getElementById("albumName")!.innerText = track.album.name;
  const albumImage = document.getElementById("albumImage") as HTMLImageElement;
  if (albumImage) {
    albumImage.src = track.album.images[0].url;
  }
  const trackPreview = document.getElementById("trackPreview") as HTMLAudioElement;
  if (trackPreview) {
    trackPreview.src = track.preview_url;
  }
}

function translateKey(key: number): string {
  const keys = [
    "C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G",
    "G♯/A♭", "A", "A♯/B♭", "B"
  ];
  return key >= 0 && key < keys.length ? keys[key] : "Unknown";
}

function translateMode(mode: number): string {
  return mode === 1 ? "Major" : mode === 0 ? "Minor" : "Unknown";
}

function displayTrackAudioFeatures(features: any) {
  const featuresElement = document.getElementById("trackFeatures");
  if (featuresElement) {
    featuresElement.innerHTML = `
      <p>Danceability: ${features.danceability}</p>
      <p>Energy: ${features.energy}</p>
      <p>Tempo: ${features.tempo}</p>
      <p>Valence: ${features.valence}</p>
      <p>Speechiness: ${features.speechiness}</p>
      <p>Acousticness: ${features.acousticness}</p>
      <p>Instrumentalness: ${features.instrumentalness}</p>
      <p>Liveness: ${features.liveness}</p>
      <p>Loudness: ${features.loudness}</p>
      <p>Key: ${translateKey(features.key)}</p>
      <p>Mode: ${translateMode(features.mode)}</p>
      <p>Time Signature: ${features.time_signature}</p>
      <p>Duration: ${features.duration_ms}</p>
    `;
  }
}
