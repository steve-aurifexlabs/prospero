window.addEventListener('DOMContentLoaded', function (event) {
    var form = document.querySelector('form')

    form.addEventListener('submit', function (event) {
        event.preventDefault()

        form.querySelector('button').setAttribute('disabled', true)

        var message = form.querySelector('p[name="message"]')
        
        var agree = form.querySelector('input[name="agree"]').checked

        if(!agree) {
            message.textContent = 'You must agree to the Terms of Service, Privacy Policy, and Cookies Policy in order to create an account.'
            form.querySelector('button').removeAttribute('disabled')
            return false
        }

        message.textContent = 'Sending request...'
        fetch('/user/create-account', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + localStorage.sessionId,
            },
        }).then(function (response) {
            if (response.ok) {
                return response.json()
            }
            
            else {
                message.textContent = 'There was an error. Please try again.'
                form.querySelector('button').removeAttribute('disabled')
            }
        })
        .then(function(data) {
            location.href = '/user/dashboard'
            
            // var backupCodeElement = document.createElement('p')
            // backupCodeElement.textContent = data.backupCode
            // message.insertAdjacentElement('afterend', backupCodeElement)

            // var dashboardButton = document.createElement('button')
            // dashboardButton.textContent = 'Continue to dashboard'
            // backupCodeElement.insertAdjacentElement('afterend', dashboardButton)
            
            // message.textContent = 'Please record and keep this backup code in a safe and secure location. In the event that you permanently lose access to the email address you just signed up with, you can use this code to change the email address associated with this account and regain access after 72 hours.'
            // message.style.maxWidth = '500px'

            // dashboardButton.addEventListener('click', function() {
            // })
        })

        return false
    })
})