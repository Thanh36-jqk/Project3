document.addEventListener('DOMContentLoaded', () => {

    const registerForm = document.getElementById('register-form');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    // const usernameInput = document.getElementById('register-username'); // Username not used for now
    const errorMessageDiv = document.getElementById('register-error');
    const successMessageDiv = document.getElementById('register-success');

    // Check whether required elements exist
    if (!registerForm || !emailInput || !passwordInput || !errorMessageDiv || !successMessageDiv) {
        console.error('Error: One or more required form elements were not found.');
        return; // Stop execution if any element is missing
    }

    // Add event listener for the 'submit' event on the form
    registerForm.addEventListener('submit', async (event) => {
        // Prevent the browser’s default form submission behavior
        event.preventDefault();

        // Clear previous error or success messages
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.display = 'none';
        successMessageDiv.textContent = '';
        successMessageDiv.style.display = 'none';

        // Get values from input fields
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        // const username = usernameInput.value.trim(); // Not used yet

        // Basic client-side validation (can add more complex checks)
        if (!email || !password) {
            errorMessageDiv.textContent = 'Please type in both email and password.';
            errorMessageDiv.style.display = 'block';
            return;
        }

        // Prepare data to send to the server
        const dataToSend = {
            email: email,
            password: password
            // username: username // Will be added later if backend is updated
        };

        console.log('Sending registration data:', dataToSend);

        // Send POST request to backend API using fetch API
        try {
            const response = await fetch('https://project3-icy1.onrender.com/api/register', {
                method: 'POST', // Use POST method
                headers: {
                    'Content-Type': 'application/json' // Let server know we’re sending JSON
                },
                body: JSON.stringify(dataToSend) // Convert JS object to JSON string
            });

            // Parse the JSON response from the server
            const result = await response.json();
            console.log('Server response:', result);

            // Check if the request was successful (2xx status code)
            if (response.ok && response.status === 201) {
                // Registration successful
                successMessageDiv.textContent = result.message + ' You can log in now.'; // Show success message
                successMessageDiv.style.display = 'block';
                registerForm.reset(); // Clear form after successful registration
                // Optional: Automatically redirect to login page after a few seconds
                // setTimeout(() => {
                //    window.location.href = 'login.html';
                // }, 2000);
            } else {
                // Registration failed (e.g., email exists, server error)
                errorMessageDiv.textContent = result.message || 'Registration failed. Please try again.'; // Show server error
                errorMessageDiv.style.display = 'block';
            }

        } catch (error) {
            // Handle network error or inability to connect to server
            console.error('Error while sending registration request:', error);
            errorMessageDiv.textContent = 'Unable to connect to the server. Please check again.';
            errorMessageDiv.style.display = 'block';
        }
    });
});
