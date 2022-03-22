var user

fetch('/user/user', {
    headers: {
        Authorization: 'Bearer ' + localStorage.sessionId,
    },
}).then(function (response) {
    if (response.ok) {
        return response.json()
    }

    else if(response.status == 404) {
        location.href = '/user/dashboard'
    }

    else if(response.status == 401) {
        location.href = '/'
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

    if(user.plan == 'standard') {
        document.querySelector('header [name="plan"]').textContent = 'Standard Plan'
    }
    
    else if(user.plan == 'pro') {
        document.querySelector('header [name="plan"]').textContent = 'Pro Plan'   
    }
    
    else if(user.plan == 'enterprise') {
        document.querySelector('header [name="plan"]').textContent = 'Enterprise Plan'
    }
    
    else {
        document.querySelector('header [name="plan"]').textContent = 'Free Plan'
    }

    var form = document.querySelector('form[name="select-plan"]')
    
    form.addEventListener('submit', function(event) {
        event.preventDefault()

        form.querySelector('button').setAttribute('disabled', true)

        var message = form.querySelector('p[name="message"]')

        var plan
        Array.from(document.querySelectorAll('input[name="plan"]')).forEach(function(item) {
            console.log(item.checked, item.value)
            if(item.checked) {
                plan = item.value
            }
        })

        if(!plan) {
            message.textContent = 'Please select a plan.'
            form.querySelector('button').removeAttribute('disabled')
            return false    
        }

        var billingPeriod
        Array.from(document.querySelectorAll('input[name="billing-period"]')).forEach(function(item) {
            console.log(item.checked, item.value)
            if(item.checked) {
                billingPeriod = item.value
            }
        })

        if(!billingPeriod) {
            message.textContent = 'Please select a billing period.'
            form.querySelector('button').removeAttribute('disabled')
            return false    
        }

        var url = '/user/payment?plan='
        if(plan == 'standard') {
            url += 'standard'
        } else if(plan == 'pro') {
            url += 'pro'
        } else if(plan == 'enterprise') {
            url += 'enterprise'
        } else {
            message.textContent = 'Invalid plan.' 
            form.querySelector('button').removeAttribute('disabled')
            return false  
        }

        url += '&billing-period='
        if(billingPeriod == 'monthly') {
            url += 'monthly'
        } else if(billingPeriod == 'annual') {
            url += 'annual'
        } else {
            message.textContent = 'Invalid billing period.'    
            form.querySelector('button').removeAttribute('disabled')
            return false  
        }

        message.textContent = 'Starting payment process...'
        fetch(url, {
            method: "POST",
            headers: {
                Authorization: 'Bearer ' + localStorage.sessionId,
                "Content-Type": "application/json",
            }
        }).then(function(result) {
            return result.json()
        }).then(function(data) {
            var stripe = Stripe('pk_live_0U9LkWhMwPP49yT8HjKoaeTa');
            
            stripe.redirectToCheckout({
                sessionId: data.sessionId
            }).then(function(result) {
                console.log(result)
            })
        })

        return false
    })

})