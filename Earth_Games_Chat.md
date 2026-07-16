# Earth Games Chat

A real-time chat application inspired by Minecraft Alpha, featuring a pixel-art UI, purple and black color palette, and smooth animations. Built with Vanilla JavaScript, HTML5, CSS3 on the frontend, and Node.js with Express and Socket.IO on the backend.

## Features

-   **Minecraft Alpha Inspired Theme:** Purple and black color palette, dark stone-like panels, pixel-art inspired UI.
-   **Real-time Messaging:** Instant message delivery using Socket.IO.
-   **Username Selection:** Users choose a unique username upon joining.
-   **Global Chat Room:** All connected users communicate in a single room.
-   **Online Users List:** Displays currently active users.
-   **Join/Leave Notifications:** System messages for user activity.
-   **Typing Indicator:** Shows when other users are typing.
-   **Emoji Support:** A selection of emojis to enhance communication.
-   **Message Timestamps:** Each message is timestamped for context.
-   **Auto-scroll:** Automatically scrolls to the latest message.
-   **Desktop Notifications:** Optional notifications for new messages (requires browser permission).
-   **Sound Notification Toggle:** Users can enable/disable sound alerts.
-   **Dark Mode (Default):** A comfortable dark theme for extended use.
-   **Responsive Mobile UI:** Optimized for seamless experience on phones and desktops.
-   **Enter to Send:** Press `Enter` to send messages.
-   **Shift+Enter for New Line:** Use `Shift+Enter` to add a new line within the message input.
-   **Auto Reconnect:** Automatically attempts to reconnect after a disconnect.
-   **Connection Status Indicator:** Visual cue for server connection status.
-   **Profanity Filter (Simple):** Basic filtering for inappropriate language.
-   **Rate Limiting (Anti-spam):** Prevents users from sending messages too rapidly.
-   **Basic Security Validation:** Server-side validation for messages and usernames.
-   **Server-side Username Sanitization:** Cleans usernames to prevent injection.

## Tech Stack

**Frontend:**
-   HTML5
-   CSS3
-   Vanilla JavaScript

**Backend:**
-   Node.js
-   Express
-   Socket.IO

## Folder Structure

```
EarthGamesChat/
├── client/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── sounds/ (empty, placeholder for future sound assets)
├── server/
│   ├── server.js
│   └── package.json
├── README.md
└── .gitignore
```

## Installation

To get a copy of the project up and running on your local machine for development and testing purposes, follow these steps.

### Prerequisites

Make sure you have Node.js and npm (Node Package Manager) installed on your system.

-   [Node.js](https://nodejs.org/)

### Steps

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/EarthGamesChat.git
    cd EarthGamesChat
    ```

2.  **Install backend dependencies:**

    Navigate to the `server` directory and install the required Node.js packages.

    ```bash
    cd server
    npm install
    ```

3.  **Start the server:**

    From the `server` directory, run the following command to start the backend server.

    ```bash
    npm start
    ```

    The server will typically run on `http://localhost:3000`.

4.  **Access the client:**

    Open your web browser and navigate to `http://localhost:3000` to access the chat application.

## Local Network Hosting

To make your chat application accessible to other devices on your local network:

1.  **Find your local IP address:**
    -   **Windows:** Open Command Prompt and type `ipconfig`.
    -   **macOS/Linux:** Open Terminal and type `ifconfig` or `ip addr`.
    Look for an address like `192.168.x.x` or `10.0.x.x`.

2.  **Allow incoming connections:**
    Ensure your firewall is configured to allow incoming connections on the port your server is running on (default: `3000`).

3.  **Share the URL:**
    Other devices on the same network can access the chat by navigating to `http://YOUR_IP_ADDRESS:3000` in their web browser.

## Internet Deployment

For deploying your Earth Games Chat application to the internet, you will need a hosting provider that supports Node.js applications. Popular choices include Heroku, Vercel, Render, or a custom VPS.

Here's a general outline:

1.  **Choose a Hosting Provider:** Select a platform that fits your needs and budget.
2.  **Prepare for Deployment:**
    -   Ensure your `package.json` `start` script is correctly configured (`node server.js`).
    -   Many platforms will automatically detect Node.js and install dependencies.
3.  **Deploy:** Follow your chosen provider's specific instructions for deploying a Node.js application. This usually involves connecting your GitHub repository and configuring environment variables (e.g., `PORT`).

## GitHub Upload Instructions

To upload this project to your GitHub repository:

1.  **Initialize a Git repository (if not already done):**

    ```bash
    git init
    ```

2.  **Add your files to the repository:**

    ```bash
    git add .
    ```

3.  **Commit your changes:**

    ```bash
    git commit -m "Initial commit: Earth Games Chat application"
    ```

4.  **Create a new repository on GitHub:**
    Go to [GitHub](https://github.com/) and create a new empty repository. Do NOT initialize it with a README or license.

5.  **Link your local repository to the GitHub repository:**

    ```bash
    git remote add origin https://github.com/your-username/your-repository-name.git
    ```
    (Replace `your-username` and `your-repository-name` with your actual GitHub username and repository name).

6.  **Push your local commits to GitHub:**

    ```bash
    git push -u origin master
    ```
    (Or `main` if your default branch is `main`).

Now your project is hosted on GitHub!
