
function validFilename(filename) {
    if(!filename || filename.length > 255) {
        return false
    }

    if(filename.includes('/') || filename.includes('\0') || filename == '..') {
        return false
    }

    return true
}

function validPath(path) {
    if(!path || path.length > 4096) {
        return false
    }

    if(path[0] != '/' || path.slice(-1) != '/') {
        return false
    }

    if(path.includes('\0') || path.includes('/../')) {
        return false
    }

    return true
}

function getFolderSize(path, done) {
    fs.lstat(item, function(err, stats) {
      if (!err && stats.isDirectory()) {
        var total = stats.size;
  
        fs.readdir(item, function(err, list) {
          if (err) return cb(err);
  
          async.forEach(
            list,
            function(diritem, callback) {
              readSizeRecursive(path.join(item, diritem), function(err, size) {
                total += size;
                callback(err);
              }); 
            },  
            function(err) {
              cb(err, total);
            }   
          );  
        }); 
      }   
      else {
        cb(err);
      }   
    }); 
}
  

function updateFilesystem(done) {
    fetch('/api/fs/folder?team=' + encodeURIComponent(team.teamId), {
        headers: {
            Authorization: 'Bearer ' + localStorage.sessionId,
        },
    }).then(function (response) {
        if (response.ok) {
            return response.json()
        }
        
        else if(response.status == 401) {
            unAuthed()
        }
    }).then(function(data) {
        if(!data) {
            return
        }
        
        // console.log('filesystem:', data)

        cleanTabs(data)
    
        var div = document.querySelector('#left-panel')
        div.innerHTML = ''
        
        var root = document.createElement('pre')
        root.style.fontSize = '26px'
        root.classList.add('folder')
        root.classList.add('open')
        root.textContent = '/'
        div.appendChild(root)

        if(data.length > 0) {
            root.emptyFolder = false
        } else {
            root.emptyFolder = true 
        }

        makeFolderClickable(root, '', '/')

        addFolder(root, data, '/', 0)   
        
        if(root.emptyFolder) {
            var msg = document.createElement('div')
            msg.classList.add('started-message')
            msg.style.paddingLeft = '20px'
            msg.innerHTML = '<p>Getting started:</p><p>Right-click on the</p><p>root folder (above)</p><p>to start working</p><p>with files.'
            div.appendChild(msg)
        }

        done && done()
    })
}

function addFolder(elm, folder, path, indentationLevel) {
    folder.sort(function(a, b) {
        if(a.type == 'folder' && b.type == 'file') {
            return 1
        }

        else if(a.type == 'file' && b.type == 'folder') {
            return -1
        }
        
        else {
            if(a.name < b.name) {
                return 1
            } else {
                return -1
            }
        }
    })

    folder.forEach(function(entry) {
        var element = document.createElement('pre')
        elm.insertAdjacentElement('afterend', element)

        var prefix = ''
        for(var i = 0; i < indentationLevel; i++) {
            prefix += '  ';
        }

        if(entry.type == 'file') {
            element.classList.add('file')
            var icon = getIconFromFilename(entry.name)
            element.textContent = prefix + ' ' + icon + ' ' + entry.name
            makeFileClickable(element, path, entry.name)
        }
        
        else if(entry.type == 'folder') {
            element.classList.add('folder')
            makeFolderClickable(element, path, entry.name)

            element.contents = entry.contents
            element.indentationLevel = indentationLevel
            
            if(entry.contents.length > 0) {
                element.emptyFolder = false
            } else {
                element.emptyFolder = true 
            }

            if(openFolders.includes(path + entry.name + '/')) {
                element.classList.add('open')
                element.textContent = prefix + ' ▼ ' + entry.name
                addFolder(element, entry.contents, path + entry.name + '/', indentationLevel + 1)
            }
            
            else {
                element.textContent = prefix + ' ▶ ' + entry.name
            }
        }
    })
}




    ///////////////
    // Filesystem

    function removeIndented(elm) {
        var l = Array.from(elm.parentElement.children)
        var i = l.indexOf(elm) + 1
        
        while(true) {
            if(i >= l.length) break
            
            var c = l[i]

            if(getIndentationLevel(c) > getIndentationLevel(elm)) {
                c.remove()
            }

            else {
                break
            }

            i += 1
        }

        function getIndentationLevel(element) {
            return element.textContent.length - element.textContent.trim().length
        }
    }

    function makeFolderClickable(elm, path, name) {
        var fullpath
        if(path) {
            fullpath = path + name + '/'
        } else {
            fullpath = '/'
        }

        elm.addEventListener('click', function(event) {
            if(fullpath == '/') return

            if(openFolders.includes(fullpath)) {
                // closeFolder
                openFolders.splice(openFolders.indexOf(fullpath), 1)
                elm.classList.remove('open')
                elm.textContent = elm.textContent.replace('▼', '▶')
                removeIndented(elm)
            }

            else {
                // openFolder
                openFolders.push(fullpath)
                elm.classList.add('open')
                elm.textContent = elm.textContent.replace('▶', '▼')
                addFolder(elm, elm.contents, fullpath, elm.indentationLevel + 1)
            }
        })

        elm.addEventListener('contextmenu', function(event) {
            event.preventDefault()
            // console.log('right click')

            var menu = document.querySelector('#context-menu')
            menu.innerHTML = ''
            menu.style.display = 'block'
            menu.style.left = (event.clientX + 5) + 'px'
            menu.style.top = (event.clientY + 5) + 'px'

            var p
            
            p = document.createElement('p')
            p.textContent = 'New File'
            menu.appendChild(p)

            p.addEventListener('click', function() {
                var f = document.createElement('form')
                
                var h2 = document.createElement('h2')
                h2.textContent = 'Create new file in'
                h2.style.marginBottom = '20px'
                
                var p = document.createElement('p')
                p.textContent = fullpath
                // p.style.margin = '50px'
                

                var input = document.createElement('input')
                input.setAttribute('type', 'text')
                
                var button = document.createElement('button')
                button.textContent = 'Create New File'

                var message = document.createElement('p')
                message.textContent = ''

                f.appendChild(h2)
                f.appendChild(p)
                f.appendChild(input)
                f.appendChild(button)
                f.appendChild(message)
                
                f.addEventListener('submit', function(event) {
                    sendNewFile(event)
                })
                
                openModal(f)

                function sendNewFile(event) {
                    event.preventDefault()

                    var filename = input.value

                    if(!filename) {
                        message.textContent = 'Filename cannot be empty.'
                        return false
                    }

                    if(filename.includes('/')) {
                        message.textContent = 'Filename cannot contain "/".'
                        return false
                    }

                    fetch('/api/fs/newFile?path=' + encodeURIComponent(fullpath) + '&filename=' + encodeURIComponent(filename) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            updateFilesystem(function() {
                                closeModal()
                                var fileView = createFileView(filename, fullpath)
                                var icon = getIconFromFilename(filename)
                                // console.log(filename, fullpath)
                                var tab = addTab(icon + ' ' + filename, 'file:' + fullpath + filename, fileView)
                                switchTab(tab)
                            })
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else if(response.status == 409) {
                            message.textContent = 'Cannot create file because it already exists.'
                        }

                        else {
                            message.textContent = 'Error: code ' + response.status
                        }
                    })

                    return false
                }

                input.focus()
            })

            p = document.createElement('p')
            p.textContent = 'Upload File'
            menu.appendChild(p)
            
            p.addEventListener('click', function() {
                var upload = document.createElement('input')
                upload.setAttribute('type', 'file')
                upload.style.display = 'none'
                document.body.appendChild(upload)

                upload.addEventListener('change', function() {
                    if(upload.files[0] === undefined) {
                        // message.textContent = 'Choose a file first.'
                        return
                    }

                    var filename = upload.files[0].name
                    
                    var progressElement = document.querySelector('progress')
                    if(!progressElement) {
                        progressElement = document.createElement('progress')
                        progressElement.style.position = 'fixed'
                        progressElement.style.bottom = '3px'
                        progressElement.style.left = '15px'
                        progressElement.style.width = '100px'
                        // uploadBar.max = '100'
                        document.body.appendChild(progressElement)
                    }
                    
                    fetch('/api/fs/uploadFile?path=' + encodeURIComponent(fullpath) + '&filename=' + encodeURIComponent(filename) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                        body: upload.files[0],
                    }).then(function(response) {
                        progressElement.remove()

                        if(response.ok) {
                            // message.textContent = 'Upload complete.'
                            // console.log('File uploaded:', upload.files[0].name)
                            // location.reload() 
                        }

                        else if(response.status == 507) {
                            promptForPayment()
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else {
                            // message.textContent = "There was an error. Please try again."
                        }
                    })
                })

                upload.click()
            })

            menu.appendChild(document.createElement('hr'))

            p = document.createElement('p')
            p.textContent = 'New Folder'
            menu.appendChild(p)

            p.addEventListener('click', function() {
                var f = document.createElement('form')
                
                var h2 = document.createElement('h2')
                h2.textContent = 'Create new folder in'
                h2.style.marginBottom = '20px'
                
                var p = document.createElement('p')
                p.textContent = fullpath

                var input = document.createElement('input')
                input.setAttribute('type', 'text')
                
                var button = document.createElement('button')
                button.textContent = 'Create New Folder'

                var message = document.createElement('p')
                message.textContent = ''

                f.appendChild(h2)
                f.appendChild(p)
                f.appendChild(input)
                f.appendChild(button)
                f.appendChild(message)
                
                f.addEventListener('submit', function(event) {
                    sendNewFolder(event)
                })
                
                openModal(f)

                function sendNewFolder(event) {
                    event.preventDefault()

                    var filename = input.value

                    if(!filename) {
                        message.textContent = 'Folder name cannot be empty.'
                        return false
                    }

                    if(filename.includes('/')) {
                        message.textContent = 'Folder name cannot contain "/".'
                        return false
                    }

                    fetch('/api/fs/newFolder?path=' + encodeURIComponent(fullpath) + '&filename=' + encodeURIComponent(filename) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            closeModal()
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else if(response.status == 409) {
                            message.textContent = 'Cannot create folder because it already exists.'
                        }

                        else {
                            message.textContent = 'Error: code ' + response.status
                        }
                    })

                    return false
                }

                input.focus()
            })

            p = document.createElement('p')
            p.textContent = 'Upload folder from zip'
            menu.appendChild(p)

            p.addEventListener('click', function() {
                var upload = document.createElement('input')
                upload.setAttribute('type', 'file')
                upload.style.display = 'none'
                document.body.appendChild(upload)

                upload.addEventListener('change', function() {
                    if(upload.files[0] === undefined) {
                        message.textContent = 'Choose a file first.'
                        return
                    }
                    
                    if(upload.files[0].type != 'application/zip') {
                        message.textContent = 'Must be a zip file.'
                        return
                    }

                    // console.log('path', path, 'name', name)
                    
                    var fullpath
                    
                    if(path) {
                        fullpath = path + name + '/'
                    }
                    
                    else {
                        fullpath = '/'
                    }

                    // console.log('fullpath', fullpath)

                    var progressElement = document.querySelector('progress')
                    if(!progressElement) {
                        progressElement = document.createElement('progress')
                        progressElement.style.position = 'fixed'
                        progressElement.style.bottom = '3px'
                        progressElement.style.left = '15px'
                        progressElement.style.width = '110px'
                        // uploadBar.max = '100'
                        document.body.appendChild(progressElement)
                    }

                    // message.textContent = 'Uploading...'
                    fetch('/api/fs/uploadFolder?path=' + encodeURIComponent(fullpath) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                        body: upload.files[0],
                    }).then(function(response) {
                        progressElement.remove()

                        if(response.ok) {
                            // message.textContent = 'Upload complete.'
                            // console.log('File uploaded:', upload.files[0].name)
                            // location.reload() 
                        }
                        
                        else if(response.status == 507) {
                            promptForPayment()
                        }
                        
                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else {
                            // message.textContent = "There was an error. Please try again."
                        }
                    })
                })

                upload.click()
            })

            // p = document.createElement('p')
            // p.textContent = 'Upload folder from git'
            // menu.appendChild(p)

            menu.appendChild(document.createElement('hr'))

            p = document.createElement('p')
            p.textContent = 'Cut'
            if(fullpath == '/') {
                p.style.color = '#888'
                p.classList.add('disabled')
            }
            menu.appendChild(p)

            p.addEventListener('click', function() {
                clipboard = {
                    type: 'folder',
                    action: 'cut',
                    path: path,
                    name: name,
                }
            })

            p = document.createElement('p')
            p.textContent = 'Copy'
            if(fullpath == '/') {
                p.style.color = '#888'
                p.classList.add('disabled')
            }
            menu.appendChild(p)

            p.addEventListener('click', function() {
                clipboard = {
                    type: 'folder',
                    action: 'copy',
                    path: path,
                    name: name,
                }
            })

            p = document.createElement('p')
            p.textContent = 'Paste'
            if(!clipboard) {
                p.style.color = '#888'
                p.classList.add('disabled')
            }
            menu.appendChild(p)

            p.addEventListener('click', function() {
                if(!clipboard) return

                // console.log('clipboard', clipboard)

                if(clipboard.action == 'cut') {
                    fetch('/api/fs/move?newPath=' + encodeURIComponent(fullpath) + '&oldPath=' + encodeURIComponent(clipboard.path) + '&filename=' + encodeURIComponent(clipboard.name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            toast('Moved <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b>')
                            clipboard = null
                        }
                                                
                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else if(response.status == 409) {
                            toast('Could not move <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b> because it already exists.')
                        }
                        
                        else {
                            toast('Could not move <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b> because of error: <b>' + response.status + '</b>')
                        }
                    })
                }
                
                if(clipboard.action == 'copy' && clipboard.type == 'file') {
                    var progressElement = document.querySelector('progress')
                    if(!progressElement) {
                        progressElement = document.createElement('progress')
                        progressElement.style.position = 'fixed'
                        progressElement.style.bottom = '3px'
                        progressElement.style.left = '15px'
                        progressElement.style.width = '110px'
                        // uploadBar.max = '100'
                        document.body.appendChild(progressElement)
                    }

                    fetch('/api/fs/copyFile?newPath=' + encodeURIComponent(fullpath) + '&oldPath=' + encodeURIComponent(clipboard.path) + '&filename=' + encodeURIComponent(clipboard.name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        progressElement.remove()

                        if(response.ok) {
                            toast('Copied <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b>')
                        }
                                                
                        else if(response.status == 401) {
                            location.href = '/'
                        }
                        
                        else if(response.status == 507) {
                            promptForPayment()
                        }

                        else if(response.status == 409) {
                            toast('Could not copy <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b> because it already exists.')
                        }
                        
                        else {
                            toast('Could not copy <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b> because of error: <b>' + response.status + '</b>')
                        }
                    })
                }

                if(clipboard.action == 'copy' && clipboard.type == 'folder') {
                    var progressElement = document.querySelector('progress')
                    if(!progressElement) {
                        progressElement = document.createElement('progress')
                        progressElement.style.position = 'fixed'
                        progressElement.style.bottom = '3px'
                        progressElement.style.left = '15px'
                        progressElement.style.width = '110px'
                        // uploadBar.max = '100'
                        document.body.appendChild(progressElement)
                    }

                    fetch('/api/fs/copyFolder?newPath=' + encodeURIComponent(fullpath) + '&oldPath=' + encodeURIComponent(clipboard.path) + '&filename=' + encodeURIComponent(clipboard.name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        progressElement.remove()

                        if(response.ok) {
                            toast('Copied <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b>')
                        }
                                                
                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else if(response.status == 507) {
                            promptForPayment()
                        }

                        else if(response.status == 409) {
                            toast('Could not copy <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b> because it already exists.')
                        }
                        
                        else {
                            toast('Could not copy <b>' + clipboard.path + clipboard.name + '</b> to <b>' + fullpath + '</b> because of error: <b>' + response.status + '</b>')
                        }
                    })
                }
            })

            menu.appendChild(document.createElement('hr'))
            
            p = document.createElement('p')
            p.textContent = 'Rename'
            if(fullpath == '/') {
                p.style.color = '#888'
                p.classList.add('disabled')
            }
            menu.appendChild(p)



            p.addEventListener('click', function() {
                var f = document.createElement('form')
                
                var h2 = document.createElement('h2')
                h2.textContent = 'Rename folder in'
                h2.style.marginBottom = '20px'
                
                var p = document.createElement('p')
                p.textContent = path

                var input = document.createElement('input')
                input.setAttribute('type', 'text')
                input.value = name
                
                var button = document.createElement('button')
                button.textContent = 'Rename'

                var message = document.createElement('p')
                message.textContent = ''

                f.appendChild(h2)
                f.appendChild(p)
                f.appendChild(input)
                f.appendChild(button)
                f.appendChild(message)
                
                f.addEventListener('submit', function(event) {
                    renameFile(event)
                })
                
                openModal(f)

                function renameFile(event) {
                    event.preventDefault()

                    var filename = input.value

                    fetch('/api/fs/rename?path=' + encodeURIComponent(path) + '&newFilename=' + encodeURIComponent(filename) + '&oldFilename=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            closeModal()
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else if(response.status == 409) {
                            message.textContent = 'Cannot create folder because it already exists.'
                        }

                        else {
                            message.textContent = 'Error: code ' + response.status
                        }
                    })

                    return false
                }

                input.focus()
            })
          

            
            p = document.createElement('p')
            p.textContent = 'Delete'
            if(fullpath == '/') {
                p.style.color = '#888'
                p.classList.add('disabled')
            }
            menu.appendChild(p)


            p.addEventListener('click', function() {
                var f = document.createElement('form')
                
                var h2 = document.createElement('h2')
                h2.textContent = 'Confirm deletion of'
                h2.style.marginBottom = '20px'
                
                var p = document.createElement('p')
                p.textContent = path + name

                var button = document.createElement('button')
                button.textContent = 'Delete'

                var message = document.createElement('p')
                message.textContent = ''

                f.appendChild(h2)
                f.appendChild(p)
                f.appendChild(button)
                f.appendChild(message)
                
                f.addEventListener('submit', function(event) {
                    deleteFolder(event)
                })
                
                openModal(f)

                function deleteFolder(event) {
                    event.preventDefault()

                    fetch('/api/fs/deleteFolder?path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function (response) {
                        if(response.ok) {
                            closeModal()
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else {
                            message.textContent = 'Error: code ' + response.status
                        }
                    })

                    return false
                }
            })

            
            menu.appendChild(document.createElement('hr'))
            
            p = document.createElement('p')
            p.textContent = 'Download as zip'
            if(elm.emptyFolder) {
                p.style.color = '#888'
                p.classList.add('disabled')
            }
            menu.appendChild(p)
            
            p.addEventListener('click', function() {
                var progressElement = document.querySelector('progress')
                if(!progressElement) {
                    progressElement = document.createElement('progress')
                    progressElement.style.position = 'fixed'
                    progressElement.style.bottom = '3px'
                    progressElement.style.left = '15px'
                    progressElement.style.width = '110px'
                    // uploadBar.max = '100'
                    document.body.appendChild(progressElement)
                }

                fetch('/api/fs/downloadFolder?path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(team.teamId), {
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer ' + localStorage.sessionId,
                    },
                })
                .then(function (response) {
                    progressElement.remove()

                    if(response.ok) {
                        return response.blob()
                    }

                    else if(response.status == 401) {
                        location.href = '/'
                    }
                })
                .then(function(blob) {
                    var url = URL.createObjectURL(blob)
                    var a = document.createElement('a')
                    a.href = url
                    if(path) {
                        a.download = name + '.zip'
                    } else {
                        a.download = 'team-' + shortTeamId + '.zip'
                    }
                    document.body.appendChild(a)
                    a.click()    
                    a.remove()
                })
            })

            var offscreenAmount = (menu.clientHeight + event.clientY + 15) - window.innerHeight
            if(offscreenAmount > 0) {
                menu.style.top = (event.clientY + 5 - offscreenAmount) + 'px'
            }

            document.body.addEventListener('click', function(event) {
                if(event.target != menu) {
                    menu.innerHTML = ''
                    menu.style.display = 'none'
                }
            })

        })
    }



    function makeFileClickable(elm, path, name) {
        elm.addEventListener('click', function() {
            // var fileView = createFileView(name, path)
            // var fileView = createFileEditorView(name, path)
            var fileView = createFileView(name, path)
            var icon = getIconFromFilename(name)
            var tab = addTab(icon + ' ' + name, 'file:' + path + name, fileView)

            switchTab(tab)
        })


        elm.addEventListener('contextmenu', function(event) {
            event.preventDefault()

            var menu = document.querySelector('#context-menu')
            menu.innerHTML = ''
            menu.style.display = 'block'
            menu.style.left = (event.clientX + 5) + 'px'
            menu.style.top = (event.clientY + 5) + 'px'
            
            var p
            
            p = document.createElement('p')
            p.textContent = 'Replace'
            menu.appendChild(p)
            
            p.addEventListener('click', function() {
                var upload = document.createElement('input')
                upload.setAttribute('type', 'file')
                upload.style.display = 'none'
                document.body.appendChild(upload)

                upload.addEventListener('change', function() {
                    if(upload.files[0] === undefined) {
                        message.textContent = 'Choose a file first.'
                        return
                    }

                    console.log(upload.files[0])
                    // console.log('path', path, 'name', name)

                    var progressElement = document.querySelector('progress')
                    if(!progressElement) {
                        progressElement = document.createElement('progress')
                        progressElement.style.position = 'fixed'
                        progressElement.style.bottom = '3px'
                        progressElement.style.left = '15px'
                        progressElement.style.width = '110px'
                        // uploadBar.max = '100'
                        document.body.appendChild(progressElement)
                    }
        
                    // progressElement.value = (100000 / upload.files[0].size).toString()

                    // message.textContent = 'Uploading...'
                    fetch('/api/fs/uploadFile?path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                        body: upload.files[0],
                    }).then(function(response) {
                        progressElement.remove()

                        if(response.ok) {
                            // message.textContent = 'Upload complete.'
                            // console.log('File uploaded:', upload.files[0].name)
                            // location.reload() 
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else {
                            // message.textContent = "There was an error. Please try again."
                        }
                    })
                })

                upload.click()
            })

            menu.appendChild(document.createElement('hr'))
            
            p = document.createElement('p')
            p.textContent = 'Cut'
            menu.appendChild(p)
            
            p.addEventListener('click', function() {
                clipboard = {
                    type: 'file',
                    action: 'cut',
                    path: path,
                    name: name,
                }
            })

            p = document.createElement('p')
            p.textContent = 'Copy'
            menu.appendChild(p)
            
            p.addEventListener('click', function() {
                clipboard = {
                    type: 'file',
                    action: 'copy',
                    path: path,
                    name: name,
                }
            })

            menu.appendChild(document.createElement('hr'))
            
            p = document.createElement('p')
            p.textContent = 'Rename'
            menu.appendChild(p)


            p.addEventListener('click', function() {
                var f = document.createElement('form')
                
                var h2 = document.createElement('h2')
                h2.textContent = 'Rename file in'
                h2.style.marginBottom = '20px'
                
                var p = document.createElement('p')
                p.textContent = path

                var input = document.createElement('input')
                input.setAttribute('type', 'text')
                input.value = name
                
                var button = document.createElement('button')
                button.textContent = 'Rename'

                var message = document.createElement('p')
                message.textContent = ''

                f.appendChild(h2)
                f.appendChild(p)
                f.appendChild(input)
                f.appendChild(button)
                f.appendChild(message)
                
                f.addEventListener('submit', function(event) {
                    renameFile(event)
                })
                
                openModal(f)

                function renameFile(event) {
                    event.preventDefault()

                    var filename = input.value

                    fetch('/api/fs/rename?path=' + encodeURIComponent(path) + '&newFilename=' + encodeURIComponent(filename) + '&oldFilename=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            closeModal()
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else if(response.status == 409) {
                            message.textContent = 'Cannot create file because it already exists.'
                        }

                        else {
                            message.textContent = 'Error: code ' + response.status
                        }
                    })

                    return false
                }

                input.focus()
            })
          


            p = document.createElement('p')
            p.textContent = 'Delete'
            menu.appendChild(p)

            p.addEventListener('click', function() {
                var f = document.createElement('form')
                
                var h2 = document.createElement('h2')
                h2.textContent = 'Confirm deletion of'
                h2.style.marginBottom = '20px'
                
                var p = document.createElement('p')
                p.textContent = path + name

                var button = document.createElement('button')
                button.textContent = 'Delete'

                var message = document.createElement('p')
                message.textContent = ''

                f.appendChild(h2)
                f.appendChild(p)
                f.appendChild(button)
                f.appendChild(message)
                
                f.addEventListener('submit', function(event) {
                    deleteFile(event)
                })
                
                openModal(f)

                function deleteFile(event) {
                    event.preventDefault()

                    fetch('/api/fs/deleteFile?path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(team.teamId), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function (response) {
                        if(response.ok) {
                            closeModal()
                        }

                        else if(response.status == 401) {
                            location.href = '/'
                        }

                        else {
                            message.textContent = 'Error: code ' + response.status
                        }
                    })

                    return false
                }
            })

            menu.appendChild(document.createElement('hr'))
            
            p = document.createElement('p')
            p.textContent = 'Download'
            menu.appendChild(p)

            p.addEventListener('click', function() {
                var progressElement = document.querySelector('progress')
                if(!progressElement) {
                    progressElement = document.createElement('progress')
                    progressElement.style.position = 'fixed'
                    progressElement.style.bottom = '3px'
                    progressElement.style.left = '15px'
                    progressElement.style.width = '110px'
                    // uploadBar.max = '100'
                    document.body.appendChild(progressElement)
                }

                fetch('/api/fs/downloadFile?path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(name) + '&team=' + encodeURIComponent(team.teamId), {
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer ' + localStorage.sessionId,
                    },
                })
                .then(function (response) {
                    progressElement.remove()
                    
                    if(response.ok) {
                        return response.blob()
                    }

                    else if(response.status == 401) {
                        location.href = '/'
                    }
                })
                .then(function(blob) {
                    var url = URL.createObjectURL(blob)
                    var a = document.createElement('a')
                    a.href = url
                    a.download = name
                    document.body.appendChild(a)
                    a.click()    
                    a.remove()
                })
            })

            var offscreenAmount = (menu.clientHeight + event.clientY + 15) - window.innerHeight
            if(offscreenAmount > 0) {
                menu.style.top = (event.clientY + 5 - offscreenAmount) + 'px'
            }

            document.body.addEventListener('click', function(event) {
                if(event.target != menu) {
                    menu.innerHTML = ''
                    menu.style.display = 'none'
                }
            })

        })
    }


function promptForPayment() {
    var f = document.createElement('form')
    
    var h2 = document.createElement('h2')
    h2.textContent = 'You are over your storage limit. Upgrade to increase your limit.'
    
    f.appendChild(h2)

    openModal(f)
}