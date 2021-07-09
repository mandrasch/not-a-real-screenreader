
Old docs!

<hr>

# Not a real Screenreader

Experimental test tool for screenreader output of websites - navigate through a web page on commandline. 

Built with puppeteer, say, chalk, readline-sync. Puppeteer allows accessing the accessibility tree since version 3.0.0. See **[accessibility.snapshot()](https://pptr.dev/#?product=Puppeteer&version=v9.1.1&show=api-class-accessibility).**

🎥 Demo video: https://www.youtube.com/watch?v=xUTCEnfepHk

## Run

- `npm install`
- `node index.js` (loads example page) or `node index.js https://yoursite.com`
- TODO: add flag for headless false/true

Default example page: https://dequeuniversity.com/library/aria/simple-dialog - try to open and close the modal :-)

Tested with node v15.12.0.

## Current limitations

- does not support clicking on links / navigating to other pages currently (script crashes)
- does not support form input

## Background

Initial goal: Provide a simple screenreader test tool for devs to recognize accessibility issues. It should work without the need of learning screenreader shortcuts beforehand. (I would love a web interface with buttons for it, but having a commandline tool is a first step. :))

I also experimented with a chrome extension, but chrome won't allow dispatching keyboard events of tabulator key to shift the focus in the browser (most likely because security). See https://github.com/mandrasch/not-a-real-screenreader for source code. Puppeteer allows sending tab key events to the browser.

Disclaimer: I'm an a11y newbie, feedback is welcome. 
