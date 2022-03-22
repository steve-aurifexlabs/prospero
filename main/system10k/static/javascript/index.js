
if(localStorage.sessionId && !location.search.includes('loggedout=true')) {
    location.href = '/user/dashboard'
}

var unverifiedEmail

(function () {
   var topForm = document.querySelector('#top-form')

    registerStartHandler(topForm)

    function registerStartHandler(form) {
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

	            document.querySelector('#top-form').style.display = 'none'
                    document.querySelector('#top-email-auth').style.display = 'block'
                }

                else {
                    form.querySelector('button').removeAttribute('disabled')
                    message.textContent = 'There was an error. Please try again. If you just requested a code, you must wait 30 seconds before requesting a new one.'
                }
            })

            return false
        })
    }
})();

(function () {
    var topAuthform = document.querySelector('form#top-email-auth')

    addAuthForm(topAuthform)

    function addAuthForm(form) {
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
                } else {
                    form.querySelector('button').removeAttribute('disabled')
                    message.textContent = 'There was an error. Please try again.'
                }
            }).then(function(data) {
                if(!data.sessionId) {
                    form.querySelector('button').removeAttribute('disabled')
                    message.textContent = 'There was an error. Please try again.'
                }

                else {
                    localStorage.sessionId = data.sessionId
                    location.href = '/user/dashboard'
                }
            })

            return false
        })
    }
})();
