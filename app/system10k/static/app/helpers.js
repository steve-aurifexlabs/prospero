
function pprint(str) {
    str.split('').forEach(function(ch, i) {
        // console.log(i, )
        if(ch == '	') {
            console.log(i, 'TAB', ch.charCodeAt(0), )
        } else if(ch == '\n') {
            console.log(i, 'NEWLINE', ch.charCodeAt(0))
        } else {
            console.log(i, ch, ch.charCodeAt(0))
        }
    })
}

var sanitizeHTML = function(str) {
    var elm = document.createElement('div')
    elm.textContent = str
    return elm.innerHTML
}


function getIconFromFilename(name) {
    // console.log(name)
    if(name.slice(-5).toLowerCase() == '.jpeg' || name.slice(-4).toLowerCase() == '.jpg' || name.slice(-4).toLowerCase() == '.png' || name.slice(-4).toLowerCase() == '.gif') {
        return '🖼️'
    }
    else if(name.slice(-5).toLowerCase() == '.webm' || name.slice(-4).toLowerCase() == '.mov' || name.slice(-4).toLowerCase() == '.mp4') {
        return '🎞️'
    }
    else if(name.slice(-4).toLowerCase() == '.pdf' || name.slice(-4).toLowerCase() == '.doc') {
        return '📄'
    }
    else if(name.slice(-4).toLowerCase() == '.wav' || name.slice(-4).toLowerCase() == '.mp3') {
        return '🎵'
    }
    else {
        return '≡'
    }
}

var crcTable = (function() {
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
})()

var crc32 = function(str) {
    var crc = 0 ^ (-1);

    for (var i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
}

function patchFile(contents, change) {
    var nDeleted = change.removed.length - 1
    change.removed.forEach(function(str) {
        nDeleted += str.length
    })
    contents = contents.slice(0, change.from) + contents.slice(change.from + nDeleted)

    var insertedText = []
    change.text.forEach(function(str) {
        insertedText.push(str)
    })
    insertedText = insertedText.join('\n')
    contents = contents.slice(0, change.from) + insertedText + contents.slice(change.from)
    
    return contents
}