

function cleanTabs(folder) {
    var flattenedFolder = flattenFolder(folder, '/')
    var tabs = document.querySelector('#tabs').children
    Array.from(tabs).forEach(function(tab) {
        if(tab.key.startsWith('file:') && !flattenedFolder.includes(tab.key.slice(5))) {
            // console.log(tab.key, flattenedFolder)
            closeTab(tab)
        }
    })
}

function closeTab(tab) {
    if(tab) {
        var selected = false
        if(Array.from(tab.classList).includes('selected')) {
            selected = true
        }
        
        tab.element.remove()
        tab.remove()

        if(document.querySelector('#tabs').children.length > 0) {
            if(selected) {
                switchTab(document.querySelector('#tabs').children[0])    
            }
        } else {
            document.querySelector('#doc-header > h2').textContent = ''
            document.querySelector('#doc-header > div').innerHTML = ''
        }
    }

    updateTabCount()
}

function addTab(name, key, element, replace) {
    var alreadyOpen = false

    var tabs = document.querySelector('#tabs')
    tabs.querySelectorAll('div').forEach(function(tab) {
        if(tab.key == key) {
            alreadyOpen = tab
        }
    })

    if(alreadyOpen) {
        return alreadyOpen
    }

    var tab = document.createElement('div')
    
    var span = document.createElement('span')
    span.textContent = name

    var closeButton = document.createElement('a')
    closeButton.textContent = 'x'
    closeButton.style.color = '#888'

    closeButton.addEventListener('click', function(event) {
        event.preventDefault()
        event.stopPropagation()

        closeTab(tab)

        return false
    })

    
    tab.appendChild(span)
    tab.appendChild(closeButton)

    tab.key = key
    tab.name = name

    var tabs = document.querySelector('#tabs')
    // tabs.appendChild(tab)
    tabs.insertBefore(tab, tabs.firstChild)

    tab.addEventListener('click', function() {
        switchTab(tab)
    })

    tab.element = element

    var mainView = document.querySelector('#main-view')
    tab.element.style.display = 'none'
    mainView.appendChild(tab.element)

    updateTabCount()

    return tab
}

function updateTabCount() {
    var tabs = document.querySelector('#tabs')
    var w = document.querySelector('#doc-header').clientWidth
    // var tab = tabs.querySelector('div')

    var startingWidth = 245

    if(tabs.children.length * startingWidth > w) {
        // var numOffscreenElements = Math.ceil((tabs.scrollWidth - tabs.clientWidth) / tab.offsetWidth)
        // document.querySelector('#more-tabs span').textContent = numOffscreenElements.toString()
        // document.querySelector('#more-tabs').style.display = 'block'

        
        tabs.childNodes.forEach(function(tab) {
            tab.childNodes[0].style.width = (w / tabs.children.length) - 22.2 + 'px'
        })
        // tabs.classList.add('scaled')
    }
    
    else {

        tabs.childNodes.forEach(function(tab) {
            tab.childNodes[0].style.width = startingWidth + 'px'
            // tab.childNodes[0].style.width = (w / tabs.children.length) - 22 + 'px'
        })
        // document.querySelector('#more-tabs').style.display = 'none'
        // tabs.classList.remove('scaled')
    }
}


function switchTab(tab) {
    var tabs = document.querySelector('#tabs')
    tabs.querySelectorAll('div').forEach(function(t) {
        t.classList.remove('selected')
        // t.element.style.opacity = '0'
        // t.element.style.zIndex = '-1'
        t.element.style.display = 'none'
    })
    
    tab.classList.add('selected')
    tab.element.style.display = 'block'
    // tab.element.style.zIndex = '1'
    // tab.element.style.opacity = '1'

    if(tab.element.querySelector('.CodeMirror')) {
        tab.element.querySelector('.CodeMirror').CodeMirror.refresh()
    }

    activeTab = tab
    
    document.querySelector('#doc-header > h2').textContent = ''
    document.querySelector('#doc-header > div').innerHTML = ''

    if(tab.key.startsWith('file:')) {
        document.querySelector('#doc-header > h2').textContent = getIconFromFilename(tab.key) + ' ' + tab.key.slice(5)
    }
    
    else {
        document.querySelector('#doc-header > h2').textContent = tab.name
    }

    document.querySelector('#doc-header > h2').textContent = document.querySelector('#doc-header > h2').textContent.slice(-85)
    
    if(tab.key.startsWith('wb:')) {
        document.querySelector('#doc-header > div').innerHTML = '<button class="save-wb">Save whiteboard</button>'
        // document.querySelector('#doc-header > div').style.float = 'left'

        var editButton = document.querySelector('#doc-header > div button.save-wb')
        editButton.style.fontSize = '18px'

        editButton.addEventListener('click', function() {
            saveWhiteboard(tab.element, tab.key)
        })
    }

    if(tab.key.startsWith('file:') && (
    tab.key.slice(-4) == '.png' ||
    tab.key.slice(-4) == '.jpg' ||
    tab.key.slice(-5) == '.jpeg' ||
    tab.key.slice(-4) == '.bmp' ||
    tab.key.slice(-5) == '.tiff' ||
    tab.key.slice(-5) == '.webp' ||
    tab.key.slice(-5) == '.avif' ||
    tab.key.slice(-4) == '.svg' )) {
        document.querySelector('#doc-header > div').innerHTML =
            '<button class="load-wb">Open as a whiteboard</button>' +
            // '<button class="edit">Start Editing</button>' +
            // '<button class="download">Download</button>' +
            '<button class="curl">curl && run</button>'
        // document.querySelector('#doc-header > div').style.float = 'left'

        var editButton = document.querySelector('#doc-header > div button.load-wb')
        // editButton.style.fontSize = '18px'

        editButton.addEventListener('click', function() {
            loadWhiteboard(tab.element.querySelector('img'))
        })
    }

    if(tab.key.startsWith('file:') && tab.name[0] == '≡') {
        // document.querySelector('#doc-header > div').innerHTML = '<button class="edit">Edit (Ctrl-S)</button><button class="push">Push (Ctrl-P)</button>'
        document.querySelector('#doc-header > div').innerHTML = '<button class="edit">Start Editing</button>'
        
        if(tab.key.endsWith('.html')) {
            document.querySelector('#doc-header > div').innerHTML =
                '<button class="edit">Start Editing</button>' +
                // '<button class="download">Download</button>' +
                '<button class="curl">curl && run</button>' +
                '<button class="web-preview">Run in browser ↗</button>'
        } else if(tab.key.endsWith('.sh')) {
            document.querySelector('#doc-header > div').innerHTML =
                '<button class="edit">Start Editing</button>' +
                // '<button class="download">Download</button>' +
                '<button class="curl">curl && run</button>'
        } else {
            document.querySelector('#doc-header > div').innerHTML =
                '<button class="edit">Start Editing</button>' +
                // '<button class="download">Download</button>' +
                '<button class="curl">curl && run</button>'
        }

        // document.querySelector('#doc-header > div').style.float = 'left'

        var editButton = document.querySelector('#doc-header > div button.edit')
        // editButton.style.fontSize = '22px'
        // editButton.style.margin = '0px 0px 0px 0px'
        // editButton.style.backgroundColor = '#fd7'
        
        if(tab.element.querySelector('.CodeMirror') && !tab.element.querySelector('.CodeMirror').CodeMirror.isReadOnly()) {
            editButton.textContent = 'Stop Editing'
        }

        editButton.addEventListener('click', function() {
            var cm = tab.element.querySelector('.CodeMirror').CodeMirror
            
            if(cm.isReadOnly()) {
                editButton.textContent = 'Stop Editing'
                tab.element.querySelector('.CodeMirror').style.backgroundColor = '#111'
                // document.querySelector('#doc-header > h2').textContent = getIconFromFilename(tab.key) + ' ' + tab.key.slice(5)
                cm.setOption('readOnly', false)
            }
            
            else {
                // editButton.textContent = 'Edit (Ctrl-S)'
                editButton.textContent = 'Start Editing'
                // editButton.style.fontSize = '20px'
                tab.element.querySelector('.CodeMirror').style.backgroundColor = '#222'
                // document.querySelector('#doc-header > h2').textContent = getIconFromFilename(tab.key) + ' ' + tab.key.slice(5) + '(read only)'
                cm.setOption('readOnly', true)
            }
        })
    }
        
    var runButton = document.querySelector('#doc-header > div button.curl')
    if(runButton) {
        runButton.addEventListener('click', function() {
            // var cm = tab.element.querySelector('.CodeMirror').CodeMirror

            var path = tab.key.slice(5).split('/').slice(0, -1).join('/') + '/'

            fetch('/api/run/start-run-session?path=' + encodeURIComponent(path), {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + localStorage.sessionId,
                },
                // body: cm.getValue(),
            }).then(function(response) {
                if(response.ok) {
                    return response.json()
                }

                else if(response.status == 401) {
                    location.href = '/'
                }

                else {
                    // message.textContent = "There was an error. Please try again."
                }
            }).then(function(data) {
                console.log(data.runSessionUrlPrefix, data.runSessionOtp)

                var hostname = 'https://' + data.runSessionUrlPrefix + '.dev.run.' + location.host.split('.').slice(-3, -2) + '.prospero.live'
                var url = '/run' + tab.key.slice(5) + '?\notp=' + data.runSessionOtp

                var filename = url.split('?')[0].split('/').slice(-1)

                // var curlExpr =
                //     'curl --include --silent \n' + hostname + '\n' + url +
                //     ' \n\n| grep -o "_prospero_live_run_session_id=\\w*"' +
                //     ' \n\n| xargs -I % sh -c \n\'curl --cookie "%" \n' + hostname + '\n' + url.split('?')[0] +
                //     '\' \n\n> ' + filename + ' \n\n&& chmod u+x ' + filename

                var curlExpr1 =
                    'export PROSPERO_LIVE_RUN_SESSION_COOKIE=`\n\ncurl --include --silent \n' + hostname + '\n' + url +
                    ' \n\n| grep -o "_prospero_live_run_session_id=\\w*"`'

                var curlExpr2 =
                    'curl --cookie $PROSPERO_LIVE_RUN_SESSION_COOKIE \n' + hostname + '\n' + url.split('?')[0] +
                    ' \n\n> ' + filename + ' \n\n&& chmod u+x ' + filename


                // toast(curlExpr)


                var button1 = document.createElement('button')
                button1.textContent = 'One off'

                var button2 = document.createElement('button')
                button2.textContent = 'Session'

                var f = document.createElement('div')

                var h2 = document.createElement('h2')
                h2.textContent = 'Run from command line'
                h2.style.marginBottom = '20px'

                var p5 = document.createElement('p')
                p5.textContent = 'Please inspect the following command line invocations and only run them if you understand what they do and what you are doing:'

                var p3 = document.createElement('p')
                p3.textContent = '1) Set an environment variable (run once per session)'
                p3.style.fontWeight = '700'
                
                var p1 = document.createElement('pre')
                p1.textContent = curlExpr1                
                
                var button1 = document.createElement('button')
                button1.textContent = 'Copy to clipboard'
                
                var hr = document.createElement('hr')
                
                var p4 = document.createElement('p')
                p4.textContent = '2) Download and run your program (edit alt+tab ↑ enter alt+tab repeat)'
                p4.style.fontWeight = '700'

                var p2 = document.createElement('pre')
                p2.textContent = curlExpr2

                if(!lastCliCommand) {
                    lastCliCommand = ' && ./' + filename
                }

                var input = document.createElement('input')
                input.setAttribute('type', 'text')
                input.value = lastCliCommand
                
                var button2 = document.createElement('button')
                button2.textContent = 'Copy to clipboard'
                button2.style.display = 'block'
                button2.style.marginTop = '25px'

                var message = document.createElement('p')
                message.textContent = ''

                f.appendChild(h2)
                f.appendChild(p5)
                f.appendChild(p3)
                f.appendChild(p1)
                f.appendChild(button1)
                f.appendChild(hr)
                f.appendChild(p4)
                f.appendChild(p2)
                f.appendChild(input)
                f.appendChild(button2)
                f.appendChild(message)
                
                button1.addEventListener('click', function(event) {
                    event.preventDefault()

                    lastCliCommand = input.value

                    curlExpr1 = curlExpr1.replaceAll('\n', '')
                    console.log(curlExpr1)
                    navigator.clipboard.writeText(curlExpr1)
                    .then(function() {}, function() {
                        console.log('clipboard permission error')
                    })

                    return false
                })

                button2.addEventListener('click', function(event) {
                    event.preventDefault()

                    lastCliCommand = input.value

                    curlExpr2 = curlExpr2.replaceAll('\n', '')
                    console.log(curlExpr2)
                    navigator.clipboard.writeText(curlExpr2 + lastCliCommand)
                    .then(function() {}, function() {
                        console.log('clipboard permission error')
                    })

                    return false
                })
                
                openModal(f)
                modal.style.minWidth = '550px'
            })
        })
    }

    var runButton2 = document.querySelector('#doc-header > div button.web-preview')
    if(runButton2) {
        runButton2.addEventListener('click', function() {
            // var cm = tab.element.querySelector('.CodeMirror').CodeMirror

            var path = tab.key.slice(5).split('/').slice(0, -1).join('/') + '/'

            fetch('/api/run/start-run-session?path=' + encodeURIComponent(path), {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + localStorage.sessionId,
                },
                // body: cm.getValue(),
            }).then(function(response) {
                if(response.ok) {
                    return response.json()
                }

                else if(response.status == 401) {
                    location.href = '/'
                }

                else {
                    // message.textContent = "There was an error. Please try again."
                }
            }).then(function(data) {
                console.log(data.runSessionUrlPrefix, data.runSessionOtp)

                window.open(
                    'https://' + data.runSessionUrlPrefix + '.dev.run.' + location.host.split('.').slice(-3, -2) + '.prospero.live/run' + tab.key.slice(5) + '?otp=' + data.runSessionOtp,
                    '_blank',
                )

                // if(data.runSessionId) {
                //     console.log(data.runSessionId)
                // }
            })
        })
    }

    webSocket.send(JSON.stringify({
        type: 'set-active-tab',
        tab: tab.name,
    }))
}

