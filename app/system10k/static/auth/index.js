document.querySelector('#short-teamid').textContent = 'Team ' + location.hostname.slice(0, 4)
document.querySelector('#rest-teamid').textContent = location.hostname.slice(4, 33)
document.title = location.hostname.slice(0, 4) + ' | Request Code | Prospero.Live'

var form = document.querySelector('form')
form.addEventListener('submit', function (event) {
    event.preventDefault()

    form.querySelector('button').setAttribute('disabled', true)

    var message = form.querySelector('p[name="message"]')

    var email = form.querySelector('input[name="email"]').value
    if (!email || !email.includes('@') || email.length > 254) {
        message.textContent = 'Please enter a valid email address.'
        form.querySelector('button').removeAttribute('disabled')
        return false
    }

    message.textContent = 'Sending request...'
    fetch('/auth/start?email=' + encodeURIComponent(email), {
        method: 'POST',
    }).then(function (response) {
        if (response.ok) {
            message.textContent = ''
            unverifiedEmail = email
            document.querySelector('#email-auth').style.display = 'block'
            document.querySelector('[name="top-form"]').style.display = 'none'
            
            // sessionStorage.unverifiedEmail = email
            // location.href = "/auth/email-verification"
            // location.href = "/auth/email-verification?a=" + btoa(email)
        }
        
        else {
            form.querySelector('button').removeAttribute('disabled')
            message.textContent = 'There was an error. Please try again. If you just requested a code, you must wait 30 seconds before requesting a new one.'
        }
    })

    return false
})

var unverifiedEmail

(function () {
    var form = document.querySelector('form#email-auth')

    var newCodeTimeElement = form.querySelector('[name="new-code-time"]')
    var newCodeTime = parseInt(newCodeTimeElement.textContent)
    function updateNewCodeTime() {
        newCodeTime -= 1
        
        if(newCodeTime > 0) {
            newCodeTimeElement.textContent = newCodeTime
            setTimeout(updateNewCodeTime, 1000)
        }
        
        else {
            var newCodeElement = form.querySelector('[name="new-code"')
            newCodeElement.innerHTML = '<a href="/">Request a new code.</a>'
        }
    }
    setTimeout(updateNewCodeTime, 1000)
    
    form.addEventListener('submit', function (event) {
        event.preventDefault()

        form.querySelector('button').setAttribute('disabled', true)
    
        var message = form.querySelector('p[name="message"]')
    
        var code = form.querySelector('input[name="code"]').value.trim()
        if (!code || code.length != 8) {
            message.textContent = 'Invalid code. Make sure you copied the whole code.'
            form.querySelector('button').removeAttribute('disabled')
            return false
        }
    
        var email = unverifiedEmail
        if (!email || !email.includes('@')) {
            message.textContent = 'Not a valid email. Please return home and start again.'
            form.querySelector('button').removeAttribute('disabled')
            return false
        }
    
        message.textContent = 'Sending request...'
        fetch('/auth/email-auth?email=' + encodeURIComponent(email) + '&code=' + encodeURIComponent(code), {
            method: 'POST',
        }).then(function(response) {
            if (response.ok) {
                return response.json()
            }

            else if(response.status == 422) {
                message.textContent = 'You must go to https://prospero.live to create an account before logging in to your team.'
                form.querySelector('button').removeAttribute('disabled')
            }

            else {
                message.textContent = 'There was an error. You must create an account before logging into a team. Please go to https://prospero.live to create an account. If you have already created an account, try again or email contact@prospero.live for support.'
                form.querySelector('button').removeAttribute('disabled')
            }
        }).then(function(data) {
            if(!data.sessionId) {
                message.textContent = 'There was an error. You must create an account before logging into a team. Please go to https://prospero.live to create an account. If you have already created an account, try again or email contact@prospero.live for support.'
                form.querySelector('button').removeAttribute('disabled')
            }
    
            else {
                localStorage.sessionId = data.sessionId
                localStorage.expiresAt = data.expiresAt
                // localStorage.email = email
    
                // if(email == data.team.creator) {
                //     localStorage.role = 'creator'
                //     localStorage.teammate = data.team.other
                // } else {
                //     localStorage.role = 'other'
                //     localStorage.teammate = data.team.creator
                // }
                
                location.href = '/'
            }
        })
    
        return false
    })
})();