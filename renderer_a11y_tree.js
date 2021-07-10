"use strict";
const electron = require('electron');

// TODO: implement search with electron API + mark.js or similiar

const ipc = electron.ipcRenderer
const currentA11yTree = document.getElementById('currentA11yTree');
ipc.on('updateA11yTree', function (evt, text) {
    console.log('Event - received:','updateA11yTree');
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Safely_inserting_external_content_into_a_page
    let pre = document.createElement("pre");
    pre.textContent = text;
    currentA11yTree.replaceChildren(pre);
});