window.addEventListener('DOMContentLoaded', function (event) {
    var form = document.querySelector('form')

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

        var message = form.querySelector('p[name="message"]')

        var code = form.querySelector('input[name="code"]').value.trim()
        if (!code || code.length != 8) {
            message.textContent = 'Invalid code. Make sure you copied the whole code.'
            return false
        }

        var email = sessionStorage.unverifiedEmail
        if (!email || !email.includes('@')) {
            message.textContent = 'Not a valid email. Please return home and start again.'
            return false
        }

        message.textContent = 'Sending request...'
        fetch('/auth/email-auth?email=' + encodeURIComponent(email) + '&code=' + encodeURIComponent(code), {
            method: 'POST',
        }).then(function(response) {
            if (response.ok) {
                return response.json()
            } else {
                message.textContent = 'There was an error. Please try again.'
            }
        }).then(function(data) {
            if(!data.sessionId) {
                message.textContent = 'There was an error. Please try again.'
            }

            else {
                localStorage.sessionId = data.sessionId
                
                delete sessionStorage.unverifiedEmail

                location.href = '/user/dashboard'
            }
        })

        return false
    })
})