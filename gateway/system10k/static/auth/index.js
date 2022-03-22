document.querySelector('#short-teamid').textContent = location.hostname.slice(0, 4)
document.querySelector('#rest-teamid').textContent = location.hostname.slice(4, 33)
document.title = location.hostname.slice(0, 4) + ' | Request Code | Prospero.Live'

var form = document.querySelector('form')
form.addEventListener('submit', function (event) {
    event.preventDefault()

    var message = form.querySelector('p[name="message"]')

    var email = form.querySelector('input[name="email"]').value
    if (!email || !email.includes('@') || email.length > 254) {
        message.textContent = 'Please enter a valid email address.'
        return false
    }

    message.textContent = 'Sending request...'
    fetch('/auth/start?email=' + encodeURIComponent(email), {
        method: 'POST',
    }).then(function (response) {
        if (response.ok) {
            localStorage.unverifiedEmail = email
            location.href = "/auth/email-verification"
        }
        
        else {
            message.textContent = 'There was an error. Please try again. If you just requested a code, you must wait 30 seconds before requesting a new one.'
        }
    })

    return false
})