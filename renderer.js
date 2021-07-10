"use strict";
console.log('RENDERER.js', window, document)

const electron = require('electron')
const ipc = electron.ipcRenderer

/*
* Event listeners
*/
// button#id will be automatically converted to IDs (electron or node?!)
const body = document.querySelector('body');
// we need to defined this, because its a#id (TODO: add role=button?)
const btnOpenWebsite = document.getElementById('btnOpenWebsite');
// other elements
const inputWebsiteUrl = document.getElementById('inputWebsiteUrl');
const boxControlCenter = document.getElementById('boxControlCenter');
const statusCurrentUrl = document.getElementById('statusCurrentUrl');
const boxScreenreaderOutput = document.getElementById('boxScreenreaderOutput');
const checkboxDisableHeadlessMode = document.getElementById('checkboxDisableHeadlessMode');

btnOpenWebsite.addEventListener('click', function () {

    console.log('clicked btnOpenWebsite');
    // show control center, hide url box
    body.classList.add('is-website-opened');

    // TODO: add info for screenreader - state change
    boxControlCenter.querySelector('h2').focus();

    // Update status
    statusCurrentUrl.innerHTML = inputWebsiteUrl.value;

    ipc.send('openWebsite', {'url':inputWebsiteUrl.value}, 10);

}, false);

btnFocusPrev.addEventListener('click',function(){
    ipc.send('triggerActionFocus', 'prev', 10);
},false);
btnFocusNext.addEventListener('click',function(){
    ipc.send('triggerActionFocus', 'next', 10);
},false);
btnTriggerEnter.addEventListener('click',function(){
    ipc.send('triggerActionEnter', null, 10);
},false);
btnReadNext.addEventListener('click',function(){
    ipc.send('triggerActionRead', 'next', 10);
},false);
btnReadPrev.addEventListener('click',function(){
    ipc.send('triggerActionRead', 'prev', 10);
},false);
btnStopReading.addEventListener('click',function(){
    ipc.send('triggerActionStopReading', 'prev', 10);
},false);

checkboxDisableHeadlessMode.addEventListener('change',function(){
    ipc.send('triggerHeadlessMode',this.checked,10);
})

btnTryWorkaround.addEventListener('click',function(){
    ipc.send('tryWorkaround',null,10);
})

/* 
* ipc: receive from main 
*/
ipc.on('updateScreenreaderOutput', function (evt, text) {
    console.log('Event - received:','updateScreenreaderOutput');
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Safely_inserting_external_content_into_a_page
    let div = document.createElement("div");
    div.textContent = text;
    boxScreenreaderOutput.replaceChildren(div);
});