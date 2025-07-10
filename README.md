# Discord Clone

A real-time chat application built with React, TypeScript, and Socket.IO that mimics Discord's interface and functionality.

## Features

- 🎨 **Discord-like UI**: Beautiful interface that closely resembles Discord's design
- 💬 **Real-time messaging**: Instant message delivery using Socket.IO
- 👥 **User management**: See who's online and their status
- 🔐 **Simple authentication**: Username-based login system
- 📱 **Responsive design**: Works on desktop and mobile devices
- 🎯 **Modern tech stack**: React, TypeScript, Tailwind CSS, Socket.IO

## Screenshots

The app features:
- Dark theme matching Discord's aesthetic
- Sidebar with server/channel navigation
- Main chat area with message history
- User list showing online members
- Real-time message updates

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd discord-clone
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd server
   npm start
   ```
   The server will run on `http://localhost:3001`

2. **Start the frontend development server**
   ```bash
   npm run dev
   ```
   The app will open in your browser at `http://localhost:3000`

3. **Open multiple browser windows/tabs** to simulate different users chatting

## Usage

1. **Login**: Enter your username to join the chat
2. **Send messages**: Type in the message input and press Enter or click Send
3. **View users**: See who's online in the right sidebar
4. **Real-time updates**: Messages and user status updates happen instantly

## Project Structure

```
discord-clone/
├── src/
│   ├── components/
│   │   ├── ChatArea.tsx      # Main chat interface
│   │   ├── LoginModal.tsx    # User authentication
│   │   ├── Sidebar.tsx       # Server navigation
│   │   └── UserList.tsx      # Online users list
│   ├── App.tsx               # Main application component
│   ├── main.tsx              # React entry point
│   └── index.css             # Global styles
├── server/
│   ├── index.js              # Socket.IO server
│   └── package.json          # Server dependencies
├── package.json              # Frontend dependencies
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS config
└── README.md                # This file
```

## Technologies Used

### Frontend
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.IO Client**: Real-time communication
- **Lucide React**: Beautiful icons

### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **Socket.IO**: Real-time bidirectional communication
- **CORS**: Cross-origin resource sharing

## Features in Detail

### Real-time Messaging
- Messages are delivered instantly to all connected users
- Message history is preserved during the session
- Timestamps show when messages were sent

### User Management
- Users can join with custom usernames
- Online status is tracked and displayed
- User list updates in real-time when people join/leave

### Discord-like Interface
- Dark theme matching Discord's color scheme
- Custom scrollbars for better UX
- Responsive design that works on all screen sizes
- Hover effects and smooth transitions

## Development

### Available Scripts

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Backend:**
- `npm start` - Start the server
- `npm run dev` - Start with nodemon (auto-restart)

### Adding Features

The app is designed to be easily extensible:

1. **New message types**: Add support for images, files, or reactions
2. **Channels**: Implement multiple chat channels
3. **Voice chat**: Add WebRTC for voice communication
4. **User profiles**: Add avatars and user settings
5. **Message reactions**: Add emoji reactions to messages

## Deployment

### Frontend (Vercel/Netlify)
1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting service

### Backend (Heroku/Railway)
1. Deploy the `server` folder
2. Update the frontend Socket.IO connection URL
3. Set environment variables if needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Inspired by Discord's beautiful interface
- Built with modern web technologies
- Designed for real-time communication

---

**Happy chatting! 🎉** 