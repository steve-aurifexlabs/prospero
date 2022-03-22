

function toast(message, timeout, priority) {
    if(!timeout) {
        timeout = 15
    }

    if(!priority) {
        priority = 0
    }

    var toast = document.createElement('div')
    toast.innerHTML = message

    toast.style.fontFamily = 'Inconsolata'

    toast.style.zIndex = priority + 2000
    toast.style.position = 'fixed'
    // toast.style.left = '300px'
    toast.style.height = '100px'
    toast.style.width = '80%'
    toast.style.fontSize = '150%'
    toast.style.background = '#ff0e'
    toast.style.border = '1px solid #555'
    toast.style.borderRight = '2px solid #555'
    toast.style.borderRadius = '10px 10px 0px 0px'
    toast.style.padding = '15px 40px'
    toast.style.left = '50%'
    toast.style.transform = 'translate(-50%, 0%)'
    
    toast.style.transition = 'bottom 0.3s'
    toast.style.bottom = '-100px'
    

    toast.classList.add('toast')

    document.body.appendChild(toast)

    setTimeout(function() {
        toast.style.bottom = '0px'
        
        setTimeout(function() {
            toast.style.bottom = '-100px'
            
            setTimeout(function() {
                document.body.removeChild(toast)
            }, 500)
        }, timeout * 1000)
    }, 100)
}


function openModal(elm) {
    var modal = document.querySelector('#modal')
    var modalOverlay = document.querySelector('#modal-overlay')

    modal.innerHTML = '<button class="close">X</button>'
    var closeButton = modal.querySelector('button.close')
    modal.appendChild(elm)
    
    modal.style.display = 'block'
    modalOverlay.style.display = 'block'
    
    modal.querySelector('button.close').addEventListener('click', function() {
        closeModal()
    })
    modalOverlay.addEventListener('click', function() {
        closeModal()
    })
}

function closeModal() {
    document.querySelector('#modal').style.display = 'none'
    document.querySelector('#modal-overlay').style.display = 'none'
}

function flattenFolder(folder, path) {
    var result = []
    folder.forEach(function(entry) {
        if(entry.type == 'file') {
            result.push(path + entry.name)
        }
        
        else if(entry.type == 'folder') {
            result.push(path + entry.name)
            var nestedFolder = flattenFolder(entry.contents, path + entry.name + '/') 
            result = result.concat(nestedFolder)
        }
    })

    return result
}

function createFileView(name, path) {
    var div = document.createElement('div')
    div.filename = name
    div.filepath = path

    var message = document.createElement('p')
    message.textContent = 'Loading file...'
    message.style.fontSize = '16px'
    div.appendChild(message)

    fetch('/api/fs/file?team=' + encodeURIComponent(team.teamId) + '&path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(name) , {
        headers: {
            Authorization: 'Bearer ' + localStorage.sessionId,
        },
    }).then(function (response) {
        if (response.ok) {
            if(name.slice(-5).toLowerCase() == '.jpeg' || name.slice(-4).toLowerCase() == '.jpg' || name.slice(-4).toLowerCase() == '.png' || name.slice(-4).toLowerCase() == '.gif') {
                return response.blob()
            }
            else if(name.slice(-5).toLowerCase() == '.webm' || name.slice(-4).toLowerCase() == '.mov' || name.slice(-4).toLowerCase() == '.mp4') {
                return response.blob()
            }
            else if(name.slice(-4).toLowerCase() == '.pdf') {
                return response.blob()
            }
            // else if(name.slice(-4).toLowerCase() == '.odt') {
            //     return response.blob()
            // }
            else if(name.slice(-4).toLowerCase() == '.wav' || name.slice(-4).toLowerCase() == '.mp3') {
                return response.blob()
            }
            else {
                return response.text()
            }
        }
        
        else if(response.status == 401) {
            unAuthed()
        }
    }).then(function(data) {
        message.remove()

        if(data === undefined || data === null) {
            var msg = document.createElement('p')
            msg.textContent = 'There was an error retreiving this file.'
            div.appendChild(msg)
        }

        else if(name.slice(-4).toLowerCase() == '.jpg' || name.slice(-5).toLowerCase() == '.jpeg' || name.slice(-4).toLowerCase() == '.png' || name.slice(-4).toLowerCase() == '.gif') {
            // codeElement.remove()  // .style.display = 'none'
            try {
                var img  = document.createElement('img')
                img.src = URL.createObjectURL(data)
                img.style.maxWidth = '100%'
                div.appendChild(img)
            } catch(err) {
                var msg = document.createElement('p')
                msg.textContent = 'Error previewing image.'
                div.appendChild(msg)
            }

        }

        else if(name.slice(-4).toLowerCase() == '.mov' || name.slice(-5).toLowerCase() == '.webm' || name.slice(-4).toLowerCase() == '.mp4') {
            // codeElement.remove()  // .style.display = 'none'
            try {
                var video  = document.createElement('video')
                video.setAttribute('controls', true)
                // video.style.maxHeight = '100%'
                // div.style.maxHeight = '100%'
                video.style.maxWidth = '100%'
                video.src = URL.createObjectURL(data)
                div.appendChild(video)
            } catch(err) {
                var msg = document.createElement('p')
                msg.textContent = 'Error previewing video.'
                div.appendChild(msg)
            }
        }

        else if(name.slice(-4).toLowerCase() == '.wav' || name.slice(-4).toLowerCase() == '.mp3') {
            try {
                var audio  = document.createElement('audio')
                audio.setAttribute('controls', true)
                // video.style.maxHeight = '100%'
                // div.style.maxHeight = '100%'
                // audio.style.maxWidth = '100%'
                audio.src = URL.createObjectURL(data)
                div.appendChild(audio)
            } catch(err) {
                var msg = document.createElement('p')
                msg.textContent = 'Error previewing audio.'
                div.appendChild(msg)
            }
        }    

        else if(name.slice(-4).toLowerCase() == '.pdf') {
            try {
                var pdf  = document.createElement('iframe')
                pdf.classList.add('pdf')
                pdf.src = URL.createObjectURL(new Blob([data], {
                    type: 'application/pdf',
                }))
                div.appendChild(pdf)
            } catch(err) {
                var msg = document.createElement('p')
                msg.textContent = 'Error previewing PDF.'
                div.appendChild(msg)
            }
        }
        
        // else if(name.slice(-4).toLowerCase() == '.odt') {
        //     try {
        //         var doc  = document.createElement('iframe')
        //         doc.classList.add('pdf')

        //         doc.src = '/lib/viewerjs/#../../'
        //         div.appendChild(doc)
        //     } catch(err) {
        //         var msg = document.createElement('p')
        //         msg.textContent = 'Error previewing ODT.'
        //         div.appendChild(msg)
        //     }
        // }
        
        else if(data.length > 400000) {
            var msg = document.createElement('p')
                msg.textContent = 'This file is too large to edit. (>400kB)'
            div.appendChild(msg)
        }
        
        else {
            
            var editor = createEditor(div, data, name, path)
            div.editor = editor
            div.classList.add('editor-wrapper')

            // console.log(data)
            // code.innerHTML = ''
            // code.appendChild(editor)
            // addCursors(editor)
        }
        // console.log('filesystem:', data)
    })

    return div
}
