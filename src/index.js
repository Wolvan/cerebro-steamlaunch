'use strict';

const fs = require("fs");
const vdfParse = require("simple-vdf2").parse;
const icon = require('./resources/icon.png');
const iconSettings = require('./resources/icon_settings.png');

const steamPath = "C:/Program Files (x86)/steam";

var steamappsPaths = [];
var steamGames = [];
var lastUsed = [];

function updateGamesList(steamapps, cb) {
    let games = [];

    let gameVDFs = [];
    for (let steamApp of steamapps) {
        if (!fs.existsSync(steamApp + "/steamapps")) continue;
        let files = fs.readdirSync(steamApp + "/steamapps").filter((item) => item.toLowerCase().endsWith(".acf"));
        files.forEach((item) => gameVDFs.push({
            path: steamApp + "/steamapps/" + item,
            library: steamApp
        }));
    }
    gameVDFs.forEach(function (item) {
        try {
            let gameFile = fs.readFileSync(item.path, "utf8");
            let parsedVDF = vdfParse(gameFile);

            games.push({
                appid: parsedVDF.AppState.appid,
                name: parsedVDF.AppState.name,
                library: item.library,
                path: item.library + "/" + parsedVDF.AppState.installdir
            });
        } catch (error) {
            console.log(error);
        }
    });
    cb({
        steamappsPaths: steamapps,
        games: games
    });
}

function init(cb) {
    let configFile = fs.readFileSync(steamPath + "/config/config.vdf", "utf8");
    let parsedVDF = vdfParse(configFile);
    let steamSection = parsedVDF.InstallConfigStore.Software.Valve.Steam;
    let baseFolders = Object.keys(steamSection).filter((item) => item.match(/BaseInstallFolder/));
    let steamapps = [steamPath];
    for (let baseFolder of baseFolders) {
        steamapps.push(steamSection[baseFolder].replace(/\\\\/g, "/"));
    }
    updateGamesList(steamapps, cb);
}
function onMessage(data) {
    if (data.steamappsPaths) steamappsPaths = data.steamappsPaths;
    if (data.games) steamGames = data.games;
    if (data.cb) data.cb(data);

    setInterval(function () {
        updateGamesList(steamappsPaths, function (data) {
            if (data.games) steamGames = data.games;
            if (data.cb) data.cb(data);
        });
    }, 60 * 60 * 1000);
}

function main({ term, display }) {
    if (term.toLowerCase().startsWith("ste")) {
        let gameSearch = term.split(" ").slice(1);
        let regex;
        try {
            regex = new RegExp(gameSearch.join(" "), "i");
        } catch (error) { }
        let gamesMatch = steamGames.filter((item) => {
            return item.name.toLowerCase().indexOf(gameSearch.join(" ").toLowerCase().trim()) !== -1 ||
                item.name.toLowerCase().indexOf(gameSearch.join("").toLowerCase().trim()) !== -1 ||
                item.name.toLowerCase().split(" ").join("").indexOf(gameSearch.join("").toLowerCase().trim()) !== -1 ||
                item.path.toLowerCase().indexOf(gameSearch.join(" ").toLowerCase().trim()) !== -1 ||
                (regex && item.path.match(regex)) ||
                (regex && item.name.match(regex));
        });

        let unplayed = [];
        gamesMatch.forEach((item) => (lastUsed.includes(item.name) ? null : unplayed.push(item.name)));
        unplayed.sort();
        let sortOrder = lastUsed.concat(unplayed);
        gamesMatch.sort((a, b) => sortOrder.indexOf(a.name) - sortOrder.indexOf(b.name));

        gamesMatch.forEach((item) => {
            display({
                icon,
                title: item.name,
                subtitle: (process.platform === "win32" ? item.path.replace(/\//g, "\\") : item.path),
                onSelect: () => {
                    if (lastUsed.includes(item.name)) lastUsed.splice(lastUsed.indexOf(item.name), 1);
                    lastUsed.unshift(item.name);
                    require('child_process').execFile(steamPath + "/steam", ['-applaunch', item.appid]);
                }
            });
        });
    }
    if (term.toLowerCase().trim() === "steam" || term.match(/steam re(load|fresh)/i)) display({
        icon: iconSettings,
        title: "Reload Steam Libraries & Games",
        subtitle: "Force a refresh of the plugin cache",
        onSelect: () => init(onMessage)
    });
    // TODO: Dynamic Steam Path
    /*if (term.toLowerCase().indexOf("steam") !== -1) display({
        icon: iconSettings,
        title: "Set Steam Folder Path",
        subtitle: "Set your Steam Folder Path it is not the default one",
        onSelect: () => {

        }
    });*/
};

module.exports = {
    initializeAsync: init,
    onMessage: onMessage,
    fn: main,
    keyword: "steam",
    name: "Launch Steam Games"
};
