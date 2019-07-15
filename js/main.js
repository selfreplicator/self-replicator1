const REPOSITORY_NAME = "self-replicator";
const API_URL = "https://api.github.com"
const REPOS_API = `${API_URL}/user/repos`;

const SOURCES_LIST = [
  "index.html",
  "js/main.js",
  "LICENSE",
  "README.md"
];

class ProgressBar {
  constructor() {
    this.inited = false;
  }

  init(id) {
    this.id = id;
    this.bar = document.getElementById(id);
    if (!this.bar) {
      throw `progress bar not found by id ${id}`;
    }

    this.inited = true;

    this.setProgress(0);
  }

  show() {
    console.log("show");

    this.bar.parentElement.style.display = "";
  }

  setProgress(ratio) {
    if (!this.inited) return;

    this.bar.style.width = `${ratio * 100}%`;
  }
}

const progressBar = new ProgressBar();

window.onload = () => {
  progressBar.init("progressBar"); 
}

function showUrl(url) {
  const urlDisplay = document.getElementById("urlDisplay");
  urlDisplay.parentElement.style.display = "";
  urlDisplay.href = url;
  urlDisplay.innerHTML = url;
}

function success(msg) {
  console.log(msg);
}

function info(msg) {
  console.info(msg);
}

function error(msg) {
  console.error(msg);
  alert(msg);
}

function debug(msg) {
  console.debug(msg);
}

function getToken() {
  const token = document.getElementById("token").value;

  if (!token) {
    const errorMsg = "Error: token cannot be empty";
    error(errorMsg);
    throw errorMsg;
  }

  return token;
}

function readFile(file, onFileRead, onError) {
  const request = new XMLHttpRequest();

  request.open("GET", file, false);
  request.onreadystatechange = () => {
    if (request.readyState === 4 &&
      (request.status === 200 || request.status === 0)) {
      onFileRead(request.responseText);
    }
    else {
      onError(request);
    }
  }

  request.send(null);
}

function uploadFile(username, repository, token, path, content) {
  debug(`uploading file ${path}`);

  const request = new XMLHttpRequest();

  request.open("PUT", `${API_URL}/repos/${username}/${repository}/contents/${path}`, false);

  request.setRequestHeader("Content-type", "application/json; charset=utf-8");
  request.setRequestHeader("Authorization", `token ${token}`);

  request.onload = event => {
    const xhr = event.target;
    if (xhr.status === 201) {
      success(`File ${path} uploaded`);
    }
    else {
      error(`Failed to upload file ${path}. ${xhr.responseText}`);
    }
  }

  request.send(JSON.stringify({
    message: `Uploaded ${path}`,
    content: btoa(content),
    branch: "master"
  }));
}

function deploy(username, token) {
  info("copying files");

  if (!username) {
    error("username is null or empty");
    return;
  }

  if (!token) {
    token = getToken();
  }

  SOURCES_LIST.forEach((file, i, files) => {
    readFile(file,
      content => {
        uploadFile(username, REPOSITORY_NAME, token, file, content);
      },
      request => {
        console.log(request);
        error(`failed to read file ${file}`);
      }
    );

    progressBar.setProgress((i + 1) / files.length);
  });

  enableGithubPages(username, REPOSITORY_NAME, token);
}

function enableGithubPages(username, repository, token) {
  debug(`enabling github pages`);

  const request = new XMLHttpRequest();

  request.open("POST", `${API_URL}/repos/${username}/${repository}/pages`, false);

  request.setRequestHeader("Authorization", `token ${token}`);
  request.setRequestHeader("Accept", "application/vnd.github.switcheroo-preview+json; application/vnd.github.mister-fantastic-preview+json");

  request.onload = event => {
    const xhr = event.target;
    if (xhr.status === 201) {
      console.log(xhr);
      showUrl(JSON.parse(xhr.response).html_url);
    }
    else {
      error(`Failed to enable github pages`);
      console.log(xhr);
    }
  }

  request.send(JSON.stringify({
    source: {
      branch: "master"
    }
  }));
}

function replicate() {
  const token = getToken();

  progressBar.show();

  request = new XMLHttpRequest();

  request.open("POST", REPOS_API);
  request.setRequestHeader("Content-type", "application/json; charset=utf-8");
  request.setRequestHeader("Authorization", `token ${token}`);

  const statusToError = statusCode => {
    const knownErrors = {
      422: "Repository already exists",
      401: "Authentication failed",
      404: "Permission denied"
    }

    return (statusCode in knownErrors) ? knownErrors[statusCode] : "Unknown error";
  }

  request.onload = event => {
    const xhr = event.target;
    const statusCode = xhr.status;

    if (statusCode === 201) {
      const response = JSON.parse(xhr.response);

      if (response.owner && response.owner.login) {
        const username = response.owner.login;
        deploy(username, token);
      }
    }
    else {
      error(statusToError(statusCode));
    }
  }

  request.send(JSON.stringify({
    "name": REPOSITORY_NAME,
    "description": "This repository is self-replicated",
    "homepage": "https://github.com",
    "private": false,
    "has_issues": false,
    "has_projects": false,
    "has_wiki": false
  }));
}
