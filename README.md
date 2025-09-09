# 🎯 Debattle - Reddit Riddle Game

An AI-powered riddle game on Reddit using Devvit. Players choose a theme, receive an AI-generated philosophical riddle, write their answer, and earn points based on AI evaluation and community upvotes.

## 🎮 Game Overview

### **Player Flow**
- Choose from 3 random themes (10-second timer)
- Receive an AI-generated riddle based on the theme
- Write an answer within 60 seconds
- Earn points from AI scoring (clarity, originality, aesthetic, time)
- Share your answer post with the community for upvotes

## 🏆 Progression System

Players level up through 7 tiers, each unlocking unique community flairs:

| Level | XP Range | Flair Title | Notes |
|-------|----------|-------------|-------|
| 1 | 0-49 | 🌱 Novice Debattler | Entry-level |
| 2 | 50-199 | ✒️ Wordsmith | Showing clarity & creativity |
| 3 | 200-499 | 🔍 Riddle Seeker | Proven solver |
| 4 | 500-999 | ⚖️ Dialectic Thinker | Balanced creator & solver |
| 5 | 1000-1999 | 🔥 Orator | High community influence |
| 6 | 2000-4999 | 🧠 Philosopher | Recognized thought-leader |
| 7 | 5000+ | 🏛️ Sage of Arete | Rare prestige title |

## 🎯 Game Mechanics

### **Scoring System**
- **Answering**: 0–20 points from AI evaluation (time, clarity, originality, aesthetic)
- **Community**: +5 points per 10 upvotes on an answer post
- **Reflections/Comments**: Commenters also gain points from upvotes on their reflections

### **Time Management**
- Theme selection: 10 seconds
- Answer writing: 60 seconds base
- AI feedback: ~15 seconds
- Post lifespan: 24 hours

### **Theme Categories**
- 🧍 Self
- 🤝 Relationships
- 💼 Work
- 🌅 Life
- 📖 Knowledge

## 🚀 Getting Started

### **For Moderators**
1. Install the Devvit app in your subreddit
2. Use the menu items to create:
   - **Create Riddle**: Start a new riddle challenge
   - **Weekly Collection**: Showcase top riddles and solvers
   - **Community Hub**: Central hub with leaderboards and info

### **For Players**
1. **Playing the Game**:
   - Choose a theme from 3 options
   - Receive an AI-generated riddle
   - Write your answer within the time limit
   - Get AI feedback and score
   - Share your answer post with the community for upvotes

## 🛠️ Technical Architecture

Built with:
- **Frontend**: React-based UI with Devvit blocks
- **Backend**: Redis for data persistence
- **Integration**: Reddit API for community features
- **Language**: TypeScript for type safety

### **Core Components**
- `Router.tsx` - Main routing and state management
- `RiddlePost.tsx` - Riddle creation workflow
- `CollectionPost.tsx` - Weekly collections
- `PinnedPost.tsx` - Community hub
- `Service.ts` - Core game logic and data management

### **Data Schema**
- `users` - User profiles and progress (Redis hash)
- `riddle:${id}` - AI-generated riddle metadata and responses
- `riddles:active` - Active riddle IDs
- `riddle:${id}:guesses` - Reflections/comments tracking per riddle

## 🔧 Development

### **Prerequisites**
- Node.js 18+
- Devvit CLI
- Redis instance

### **Installation**
```bash
npm install
npm run dev
```

### **Building & Deployment**
```bash
npm run build
npm run deploy
```

## 🎨 Customization

The game is highly customizable:
- Modify theme categories and difficulty
- Adjust scoring algorithms
- Customize level progression
- Add new game modes

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- AI-powered riddle generation and evaluation improvements
- Advanced moderation tools
- Mobile-optimized interfaces
- Additional game modes

## 📄 License

BSD-3-Clause License - see LICENSE file for details.

## 🏛️ About

Debattle brings the ancient art of riddles to the modern Reddit community, fostering creativity, critical thinking, and friendly competition. Join the community and become a Sage of Arete!
