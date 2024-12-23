const WebSocket = require('ws');
const http = require('http');
const server = http.createServer();
const wss = new WebSocket.Server({ server });

let fastestTeam = null;
let currentQuestion = 1;
let subquestionsStatus = {}; // Stores correctness of subquestions
let answeredTeams = new Set(); // Tracks teams that have already answered

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'teamSubmit') {
            if (!fastestTeam && !answeredTeams.has(data.username)) {
                // Mark this team as the fastest and lock the submit button for others
                fastestTeam = data.username;
                answeredTeams.add(data.username);

                // Broadcast this team's submission to the host
                broadcastToHost({
                    type: 'teamSubmit',
                    teamId: data.username,
                    answers: data.answers,
                });

                // Lock submit button for other teams
                broadcastToTeams({ type: 'lockSubmit' });
            }
        } else if (data.type === 'markAnswer') {
            // Update the subquestionsStatus with the marked answer status
            subquestionsStatus[data.subQuestion] =
                data.status === 'correct' ? 'Correct' : 'Wrong';

            // Broadcast the marked answer status to all clients
            broadcastToTeams({
                type: 'markAnswer',
                subQuestion: data.subQuestion,
                status: data.status, // 'correct' or 'wrong'
                teamId: data.teamId, // Team that marked the answer
            });
        } else if (data.type === 'continue') {
            const remainingSubquestions = Object.keys(subquestionsStatus).filter(
                (key) => subquestionsStatus[key] === 'Wrong'
            );

            // Broadcast unlocking submit and the remaining subquestions
            broadcastToTeams({
                type: 'unlockSubmit',
                remainingSubquestions: remainingSubquestions,
            });
            fastestTeam = null; // Reset fastest team
        } else if (data.type === 'nextQuestion') {
            currentQuestion = data.questionNumber;
            subquestionsStatus = {}; // Reset subquestions status
            fastestTeam = null; // Reset fastest team
            answeredTeams.clear(); // Clear answered teams for the next question

            // Ensure that every time we send the "nextQuestion", it has exactly 3 subquestions
            broadcastToTeams({
                type: 'nextQuestion',
                questionNumber: currentQuestion,
                subquestions: ['1', '2', '3'], // Always send 3 subquestions
            });

            // Broadcast to unlock submit button for all teams
            broadcastToTeams({
                type: 'unlockSubmit',
                remainingSubquestions: ['1', '2', '3'], // Reset to all subquestions for the new question
            });
        }
    });
});

function broadcastToTeams(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function broadcastToHost(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

server.listen(8080, () => {
    console.log('Server running on ws://localhost:8080');
});
