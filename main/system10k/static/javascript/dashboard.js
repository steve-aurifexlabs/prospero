// var envPrefix = ''

var loggedOutUrl = '/?loggedout=true'

var user

var teammates

document.querySelector('form#register-key').addEventListener('submit', function(event) {
	event.preventDefault()

	var form = document.querySelector('form#register-key')
	var nickname = form.querySelector('input').value

	fetch('/user/register-key?nickname=' + encodeURIComponent(nickname), {
	        method: "POST",
	        headers: {
	            Authorization: 'Bearer ' + localStorage.sessionId,
	            "Content-Type": "application/json",
	        },
	}).then(function(result) {
		return result.json()
	}).then(function(data) {
		console.log(data)

		const cose_alg_ECDSA_w_SHA256 = -7

		navigator.credentials.create({
			publicKey: {
				challenge: Uint8Array.from(atob(data.challenge), c=>c.charCodeAt(0)),
				rp: {
					name: 'Prospero.Live',
					id: 'prospero.live',
				},
				user: {
					id: Uint8Array.from(user.email, c=>c.charCodeAt(0)),
					name: user.email,
					displayName: user.email,
				},
				pubKeyCredParams: [{
			            type: "public-key",
			            alg: cose_alg_ECDSA_w_SHA256,
			        }],
			        timeout: 60000,
			        attestation: "none",
			        authenticatorSelection:{
			          authenticatorAttachment: "cross-platform",
			          requireResidentKey: true,
			          userVerification: "preferred",
			        },
			},
		}).then(function(credential) {
			console.log(credential)

			const utf8Decoder = new TextDecoder('utf-8')
			const clientData = JSON.parse(utf8Decoder.decode(credential.response.clientDataJSON))

			fetch('/user/register-key2?nickname=' + encodeURIComponent(nickname), {
			        method: "POST",
			        headers: {
			            Authorization: 'Bearer ' + localStorage.sessionId,
			            "Content-Type": "application/json",
			        },
				body: JSON.stringify({
					id: credential.id,
					attestationObject: btoa(attestationObject),
					clientData: clientData,
				}),
			}).then(function(result) {
				return result.json()
			}).then(function(data) {
				console.log(data)
			})

		})

	})

	return false
})

fetch('/user/user', {
    headers: {
        Authorization: 'Bearer ' + localStorage.sessionId,
    },
}).then(function (response) {
    if (response.ok) {
        return response.json()
    }

    else if(response.status == 404) {
    	location.href = loggedOutUrl
    }

    else if(response.status == 401) {
        location.href = loggedOutUrl
    }

    else {
        console.log(response.status)
    }
}).then(function(data) {
    user = data
    if(!user) {
        return
    }
    
    console.log('user:', user)

    document.querySelector('header [name="email"]').textContent = user.email

    var form = document.querySelector('form[name="new-team"]')

    form.addEventListener('submit', function(event) {
        event.preventDefault()

        form.querySelector('button').setAttribute('disabled', true)

        var message = form.querySelector('p[name="message"]')

        var email = form.querySelector('input[name="partner-email"]').value
        if(!email || !email.includes('@') || email.length > 254) {
            message.textContent = 'Please enter a valid email address.'
            return false
        }

        var region = 'nyc'
        var newTeamUrl = '/user/newTeam?email=' + encodeURIComponent(email) + '&region=' + encodeURIComponent(region)

        message.textContent = 'Sending request...'
        fetch(newTeamUrl, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + localStorage.sessionId,
            },
        }).then(function(response) {
            if(response.ok) {
                return response.json()
            }

            else if(response.status == 400) {
                message.textContent = 'Error. Try again.'
            }

            else if(response.status == 401) {
                location.href = loggedOutUrl
            }
        }).then(function(data1) {
            fetch('/user/request-otp', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + localStorage.sessionId,
                },
            }).then(function(response) {
                if(response.ok) {
                    return response.json()
                }
                
                else if(response.status == 401) {
                    location.href = loggedOutUrl
                }
            }).then(function(data2) {
                var urlPrefix = data1.teamId.slice(0, 4) + '-' + data1.teamId.slice(4, 32)
                var baseUrl = 'https://' + urlPrefix + '.app.prosperodev.live'
                location.href = baseUrl + '?otp=' + encodeURIComponent(data2.otp)
            })
        })

        return false
    })

    var logoutLink = document.querySelector('[name="logout"]')

    logoutLink.addEventListener('click', function (event) {
        event.preventDefault()

        fetch('/auth/logout', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + localStorage.sessionId,
            },
        }).then(function (response) {
            if (response.ok) {
                delete localStorage.sessionId
                location.href = loggedOutUrl
            }
            
            else {
                console.log('Logout failed.')
            }
        })

        return false
    })

    document.querySelector('[name="refresh"]')
    .addEventListener('click', function (event) {
        event.preventDefault()

        location.reload()

        return false
    })



    fetch('/user/teams', {
        headers: {
            Authorization: 'Bearer ' + localStorage.sessionId,
        },
    }).then(function (response) {
        if (response.ok) {
            return response.json()
        }

        else if(response.status == 401) {
            location.href = loggedOutUrl
        }
        
        else {
            console.log(response.status)
        }   
    }).then(function(data) {
        teams = data
        if(!teams) {
            return
        }

        if(teams.length > 0) {
            document.querySelector('#teams-message').style.display = 'none'
        } else {
            document.querySelector('#teams-message').textContent = ''
        }
        
        console.log('teams:', teams)
        
	teammates = {}

	teams.forEach(function(team) {
	    if(user.email != team.creator) {
		if(!teammates[team.creator]) {
	    	    teammates[team.creator] = { yours: [], theirs: [] }
		}
		teammates[team.creator].theirs.push(team)
	    } else {
	    	if(!teammates[team.other]) {
                    teammates[team.other] = { yours: [], theirs: [] }
                }
                teammates[team.other].yours.push(team)
	    }
	})

	var names = Object.keys(teammates)
	names.sort()

	names.forEach(function(teammateEmail) {
	    var teammate = teammates[teammateEmail]
	
	    var details = document.createElement('details')
	    var s = document.createElement('summary')
	    s.style.fontSize = '200%'
	    s.textContent = teammateEmail
	    details.appendChild(s)
	    document.querySelector('#teams-div').appendChild(details)

	    teammate.yours.sort(function(a, b) {
		if(a.createdat < b.createdat) {
		    return -1
		}

		if(a.createdat > b.createdat) {
                    return 1
                }

		return 0
	    })

	    teammate.theirs.sort(function(a, b) {
                if(a.createdat < b.createdat) {
                    return -1
                }

                if(a.createdat > b.createdat) {
                    return 1
                }

                return 0
            })


	    // <<-----
	// <<---------
	teammate.yours.concat(teammate.theirs).forEach(function(team) {
            if((user.email == team.other && team.inviterejected) || (user.email == team.third && team.thirdrejected)) {
                return
            }
            
            team.teamId = team.teamid

            var teamString = team.creator + ' | ' + team.other
            if(team.third) {
                teamString += ' | ' + team.third
            }

            if((!team.inviteaccepted && user.email == team.other) || (!team.thirdaccepted && user.email == team.third)) {
                var button = document.createElement('button')
                button.style.margin = '10px'
                button.textContent = 'Accept'
                
                button.addEventListener('click', function(event) {
                    fetch('/user/acceptInvite?teamId=' + encodeURIComponent(team.teamid), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            fetch('/user/request-otp', {
                                method: 'POST',
                                headers: {
                                    Authorization: 'Bearer ' + localStorage.sessionId,
                                },
                            }).then(function(response) {
                                if(response.ok) {
                                    return response.json()
                                }
                                
                                else if(response.status == 401) {
                                    location.href = loggedOutUrl
                                }
                            }).then(function(data) {  
                                var urlPrefix = team.teamId.slice(0, 4) + '-' + team.teamId.slice(4, 32)
                                var baseUrl = 'https://' + urlPrefix + '.app.prosperodev.live'
                                location.href = baseUrl + '?otp=' + encodeURIComponent(data.otp)
                                // location.href = a.getAttribute('href') + '?otp=' + data.otp
                            })
                            // location.href = 'https://' + team.teamId.slice(0, 4) + '-' + team.teamId.slice(4) + '.' + envPrefix + 'app.' + team.nodeid + '.prospero.live/'
                        }
                        
                        else if(response.status == 401) {
                            location.href = loggedOutUrl
                        }
                    })
                })        
                    
                var button2 = document.createElement('button')
                button2.style.margin = '10px'
                button2.style.backgroundColor = '#faa'
                button2.textContent = 'Decline'
                button2.addEventListener('click', function(event) {
                    fetch('/user/declineInvite?teamId=' + encodeURIComponent(team.teamid), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            location.reload()
                        }
                        
                        else if(response.status == 401) {
                            location.href = loggedOutUrl
                        }
                    })
                })

                var d = document.createElement('div')

                var h = document.createElement('h2')
                h.textContent = 'Invite'
                d.appendChild(h)
                        
                var p = document.createElement('p')
                p.appendChild(document.createTextNode('Workspace ' + team.teamId.slice(0, 4) + '-' + team.teamId.slice(4)))
                d.appendChild(p)
                
                var p1 = document.createElement('p')
                p1.appendChild(document.createTextNode(teamString))
                d.appendChild(p1)

                // var p2 = document.createElement('p')
                // p2.appendChild(document.createTextNode('Server ' + team.nodeid))
                // d.appendChild(p2)

                var p3 = document.createElement('p')
                p3.textContent = 'Created: ' + new Date(team.createdat)
                d.appendChild(p3)

                var p4 = document.createElement('p')
                p4.appendChild(button)
                p4.appendChild(button2)
                d.appendChild(p4)

                // document.body.insertBefore(p, document.querySelector('body > footer'))
                document.querySelector('header').insertAdjacentElement('afterend', d)
            }
            
            else {
                var d = document.createElement('div')
		d.style.padding = '20px'
		d.style.border = '1px solid black'

                var p1 = document.createElement('p1')
                
                var shortSpan = document.createElement('span')
                shortSpan.style.fontWeight = '700'
                shortSpan.style.fontSize = '400%'
                shortSpan.textContent = team.teamId.slice(0, 4)
                p1.appendChild(shortSpan)

                var longSpan = document.createElement('span')
                longSpan.textContent = '-' + team.teamId.slice(4)
                p1.appendChild(longSpan)

                if(!team.inviteaccepted && !team.thirdaccepted) {
                    longSpan.textContent += ' - waiting for teammate to accept invite'
                }
                d.appendChild(p1)
                
                var p = document.createElement('p')
                p.textContent = teamString
                d.appendChild(p)

                // var p2 = document.createElement('p')
                // p2.textContent = 'Server ' + team.nodeid
                // d.appendChild(p2)

                var p3 = document.createElement('p')
                p3.textContent = 'Created: ' + new Date(team.createdat)
                d.appendChild(p3)
        
                var a = document.createElement('a')
                a.setAttribute('href', 'https://' + team.teamId.slice(0, 4) + '-' + team.teamId.slice(4) + '.app.prosperodev.live/')
                a.classList.add('big-link')
                a.textContent = 'Go to workspace'
                d.appendChild(a)
		/*
		var p4 = document.createElement('p')
		p4.textContent = 'Fork from recent snapshot (past 1 hour):'
		d.append(p4)

		var message = document.createElement('p')
		d.append(message)

		for(var i = 3; i < 60; i += 5) { (function() {
			var snapshotTime = 1 * i

			var backupButton = document.createElement('button')
			backupButton.textContent = ':' + i
			backupButton.classList.add('backup-button')
			p4.appendChild(backupButton)

			backupButton.addEventListener('click', function(event) {
				var partnerEmail
				if(user.email == team.creator) {
					partnerEmail = team.other
				} else {
					partnerEmail = team.creator
				}

				var url = '/user/new-project-from-snapshot?email=' + encodeURIComponent(partnerEmail) + '&team=' + encodeURIComponent(team.teamId) + '&snapshot=' + encodeURIComponent(snapshotTime.toString())

			        // message.textContent = 'Sending request...'
			        fetch(url, {
			            method: 'POST',
			            headers: {
			                Authorization: 'Bearer ' + localStorage.sessionId,
			            },
			        }).then(function(response) {
			            if(response.ok) {
			                return response.json()
			            }

			            else if(response.status == 400) {
			                message.textContent = 'Error. Try again.'
			            }

			            else if(response.status == 401) {
			                location.href = loggedOutUrl
			            }
			        }).then(function(data1) {
			            fetch('/user/request-otp', {
			                method: 'POST',
			                headers: {
			                    Authorization: 'Bearer ' + localStorage.sessionId,
			                },
			            }).then(function(response) {
			                if(response.ok) {
			                    return response.json()
			                }
			                
			                else if(response.status == 401) {
			                    location.href = loggedOutUrl
			                }
			            }).then(function(data2) {
			                var urlPrefix = data1.teamId.slice(0, 4) + '-' + data1.teamId.slice(4, 32)
			                var baseUrl = 'https://' + urlPrefix + '.app.prosperodev.live'
			                location.href = baseUrl + '?otp=' + encodeURIComponent(data2.otp) + '&original=' + encodeURIComponent(team.teamId)
			            })
			        })
				
			})
		})()}
		*/
                a.addEventListener('click', function(event) {
                    event.preventDefault()

                    fetch('/user/request-otp', {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + localStorage.sessionId,
                        },
                    }).then(function(response) {
                        if(response.ok) {
                            return response.json()
                        }
                        
                        else if(response.status == 401) {
                            location.href = loggedOutUrl
                        }
                    }).then(function(data) {
                        location.href = a.getAttribute('href') + '?otp=' + encodeURIComponent(data.otp)
                    })

                    return false
                })

                // document.body.insertBefore(d, document.querySelector('#first-note'))
	        // document.querySelector('#teams-div').appendChild(d)
	        details.appendChild(d)
                // document.body.insertBefore(d, form)
            }
        })
        })
    })
})
