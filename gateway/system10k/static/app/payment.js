
function promptForPayment() {
    var f = document.createElement('form')
    
    var h2 = document.createElement('h2')
    h2.textContent = 'Upgrade to a paid account to upload a file larger than 100KB.'
    h2.style.marginBottom = '20px'
    
    var p = document.createElement('p')
    p.textContent = 'Paid users get 100MB cloud storage. $9 / month. Billed monthly.'
    // p.style.margin = '50px'
    
    var button = document.createElement('button')
    button.textContent = 'Upgrade to paid account'

    var message = document.createElement('p')
    message.textContent = ''

    f.appendChild(h2)
    f.appendChild(p)
    // f.appendChild(input)
    f.appendChild(button)
    f.appendChild(message)
    
    f.addEventListener('submit', function(event) {
        event.preventDefault()

        fetch('/api/payment', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + localStorage.sessionId,
            },
        }).then(function (response) {
            if (response.ok) {
                return response.text()
            }
        }).then(function(sessionId) {
            stripe.redirectToCheckout({
                sessionId: sessionId,
            }).then(function (result) {
                console.log(result.error.message)
                // If `redirectToCheckout` fails due to a browser or network
                // error, display the localized error message to your customer
                // using `result.error.message`.
            });
        })

        return false
    })
    
    openModal(f)
}

// var stripe = Stripe('pk_test_IDMiC3EaKk17E7Ymp9pkdlaC');
