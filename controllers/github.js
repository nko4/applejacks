//
//     npm-pulse
//     Copyright(c) 2013 Applejacks
//     Charlie Key, Taron Foxworth, Matt Hernandez
//     MIT Licensed
//

var request = require('request')
  , util    = require('util')
  , Q       = require('q')
  , path    = require('path');

const GITHUB_ROOT_URL = 'https://api.github.com';
const REPORT_CARD_URL = 'http://osrc.dfm.io/';
const UA_STRING       = 'applejacks/npm-pulse';

//
// Helper for getting data from GitHub.
//
var get = function get(uri) {
  var deferred = Q.defer();
  var opts = {
    methid: 'GET'
  , url: GITHUB_ROOT_URL + uri
  , json: true
  , headers: {
      'User-Agent': UA_STRING
    }
  };

  request(opts, function(err, response, body) {
    if (err) return deferred.reject(err);
    if (response.statusCode !== 200) return deferred.reject(new Error(body.message));

    deferred.resolve(body);
  });

  return deferred.promise;
};

//
// Get releases for the specified repository.
//
var getRepo = function(meta) {
  return get(util.format('/repos/%s/%s', meta.user, meta.name));
};

//
// Get contributors array for the specified repository.
//
var getContributors = function(meta) {
  return get(util.format('/repos/%s/%s/stats/contributors', meta.user, meta.name));
};

//
// Split the repo object into something usable by the GitHub API.
//
var getRepoMeta = function(repo) {
  if (!repo || repo.length === 0) return '';

  var bits = repo.url.split('/');

  return {
    user: bits[3]
  , name: bits[4].replace('.git', '')
  };
};

//
// Calculate the popularity of the repo based on watchers, stars, forks, downloads
//
var calculatePopularity = function(watchers, stars, forks, downloads) {
  var totalActivity = watchers + stars + forks + downloads;

  var watchersPercent = watchers/totalActivity;
  var starsPercent = stars/totalActivity;
  var forksPercent = forks/totalActivity;
  var downloadsPercent = downloads/totalActivity;

  var watchersPoints = watchers * ( 1 - watchersPercent);
  var starsPoints = stars * ( 1 - starsPercent);
  var forksPoints = forks * ( 1 - forksPercent);
  var downloadsPoints = downloads * ( 1 - downloadsPercent);

  var topPoints = 47505.05444166553; // Express

  return ((watchersPoints + starsPoints + forksPoints + downloadsPoints)/topPoints);

};

//
// Calculate the quality of the repo based on popularity and issues
//
var calculatePopularity = function(popularity, closed_issues, open_issues, last_commit) {
  var totalActivity = watchers + stars + forks + downloads;

  var watchersPercent = watchers/totalActivity;
  var starsPercent = stars/totalActivity;
  var forksPercent = forks/totalActivity;
  var downloadsPercent = downloads/totalActivity;

  var watchersPoints = watchers * ( 1 - watchersPercent);
  var starsPoints = stars * ( 1 - starsPercent);
  var forksPoints = forks * ( 1 - forksPercent);
  var downloadsPoints = downloads * ( 1 - downloadsPercent);

  var topPoints = 47505.05444166553; // Express

  return ((watchersPoints + starsPoints + forksPoints + downloadsPoints)/topPoints);

};

//
// GitHub constructor used to work with repositories.
//
var GitHub = function() {
};

//
// Aggregate the data from each endpoint and return the compiled JSON object
//    for the module object.
//
GitHub.prototype.getRepo = function(module, fn) {
  if (typeof module.repository === 'undefined') return fn(new Error('No repository specified for that module.'));
  if (module.repository.type !== 'git' ||
      module.repository.url.indexOf('github') === -1) return fn(new Error('The specified module is not stored on GitHub.'));

  var meta     = getRepoMeta(module.repository)
    , data     = {}
    , versions = Object.keys(module.time);

  //
  // Attach data from the npm registry.
  //
  data.name = module.name;
  data.description = module.description;
  data.report_card = REPORT_CARD_URL + meta.user;
  data.initial_release = {
    version: versions[0]
  , date: module.time[versions[0]]
  };
  data.latest_release = {
    version: versions[versions.length - 1]
  , date: module.time[versions[versions.length - 1]]
  };
  data.author = {
    name: module.author.name
  };
  data.versions = module.time;

  getRepo(meta)
    .then(function(repo) {
      //
      // Attach data from GitHub.
      //
      data.stars = repo.stargazers_count;
      data.issues = repo.open_issues;
      data.watchers = repo.watchers_count;
      data.forks = repo.forks_count;
      data.author.avatar_url = repo.owner.avatar_url;
      data.author.username = repo.owner.login;
      data.author.url = repo.owner.html_url;
      data.url = repo.html_url;
      data.issues_url = path.join(repo.html_url, 'issues');
      data.fork = path.join(repo.html_url, 'fork');
      data.network_url = path.join(repo.html_url, 'network');
      data.star = path.join(repo.html_url, 'star');
      data.stargazers = path.join(repo.html_url, 'stargazers');

      data.popularity = calculatePopularity(data.watchers,data.stars,data.forks,881818);

      return getContributors(meta);
    })
    .then(function(contributors) {
      data.contributors = contributors;

      fn(null, data);
    })
    .fail(function(err) {
      console.error(err.message);
      console.error(err.stack);
      fn(err);
    })
    .done();
};

//
// Returns a new GitHub instance.
//
module.exports = function() {
  return new GitHub();
};
