const crypto = require('crypto');

class SecureRandom {
    constructor() {
        this.key = crypto.randomBytes(32).toString('hex');
    }

    generateHMAC(value) {
        const hmac = crypto.createHmac('sha256', this.key);
        hmac.update(value.toString());
        return hmac.digest('hex');
    }

    revealKey() {
        return this.key;
    }
}

class DiceGame {
    constructor(diceSets) {
        if (diceSets.length < 3) {
            throw new Error("Invalid input: At least 3 dice configurations are required. Example: node game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3");
        }

        this.diceSets = diceSets.map(set => set.split(',').map(Number));
        this.validateDiceSets();
        this.secureRandom = new SecureRandom();
        this.firstPlayer = null; // 0 = User, 1 = Computer
        this.selectedDice = { user: null, computer: null };
    }

    validateDiceSets() {
        const faceCount = this.diceSets[0].length;

        this.diceSets.forEach((dice, index) => {
            // Check if all values are integers
            if (!dice.every(Number.isInteger)) {
                throw new Error(
                    `Error: Invalid dice set: ${this.diceSets[index].join(",")}. Dice sets must contain only integers.`
                );
            }

            // Check if all dice sets have the same number of faces
            if (dice.length !== faceCount) {
                throw new Error(
                    `Error: All dice sets must have the same number of faces. Dice set ${index + 1} has ${dice.length} faces, expected ${faceCount}.`
                );
            }
        });
    }

    promptFirstMove() {
        const randomValue = Math.floor(Math.random() * 2);
        const hmac = this.secureRandom.generateHMAC(randomValue);
        console.log(`I selected a random value in the range 0..1 (HMAC=${hmac}).`);
        console.log("Try to guess my selection.");
        console.log("0 - 0\n1 - 1\nX - exit\n? - help");

        const userGuess = this.getUserInput(["0", "1", "X", "?"], "Your selection: ");
        if (userGuess === "X") {
            console.log("Goodbye!");
            process.exit();
        } else if (userGuess === "?") {
            this.showHelp();
            return this.promptFirstMove();
        }

        const key = this.secureRandom.revealKey();
        console.log(`My selection: ${randomValue} (KEY=${key}).`);
        this.firstPlayer = parseInt(userGuess, 10) === randomValue ? 0 : 1;
        console.log(this.firstPlayer === 0 ? "You make the first move!" : "I make the first move!");
    }

    selectDice(player) {
        if (player === 1) {
            const computerChoice = 1;
            this.selectedDice.computer = this.diceSets[computerChoice];
            this.diceSets.splice(computerChoice, 1);
            console.log(`I choose the [${this.selectedDice.computer.join(",")}].`);
        } else {
            console.log("Choose your dice:");
            this.diceSets.forEach((set, index) => {
                console.log(`${index} - [${set.join(",")}]`);
            });

            const userChoice = parseInt(this.getUserInput(this.diceSets.map((_, i) => i.toString()), "Your selection: "), 10);
            this.selectedDice.user = this.diceSets[userChoice];
            this.diceSets.splice(userChoice, 1);
            console.log(`You choose the [${this.selectedDice.user.join(",")}].`);
        }
    }

    playRound() {
        console.log("\n--- Collaborative Random Number Generation ---");
        const x = Math.floor(Math.random() * 6); // Computer generates random number x
        const hmac = this.secureRandom.generateHMAC(x); // HMAC of x
        console.log(`HMAC of my number: ${hmac}`);

        console.log("Select a number (y) from the range {0,1,2,3,4,5}:");
        const userInput = this.getUserInput(["0", "1", "2", "3", "4", "5"], "Your number (y): ");
        const y = parseInt(userInput, 10); // User selects number y

        const result = (x + y) % 6; // Calculate result
        console.log(`The result is: (${x} + ${y}) % 6 = ${result}`);

        // Reveal x and the key
        const key = this.secureRandom.revealKey();
        console.log(`My number (x): ${x}`);
        console.log(`Key: ${key}`);

        console.log("\n--- Dice Game ---");
        const userRoll = this.throwDice(this.selectedDice.user);
        const computerRoll = this.throwDice(this.selectedDice.computer);

        console.log(`Your throw is ${userRoll}.`);
        console.log(`My throw is ${computerRoll}.`);

        if (userRoll > computerRoll) {
            console.log("You win! 🎉");
        } else if (userRoll < computerRoll) {
            console.log("I win! 🤖");
        } else {
            console.log("It's a tie! 🤝");
        }
    }

    throwDice(dice) {
        const randomIndex = Math.floor(Math.random() * dice.length);
        return dice[randomIndex];
    }

    showHelp() {
        console.log("Help: This is a dice game where you and I select dice and take turns throwing them. The player with the higher throw wins the round.");
        console.log("Here is the probability table for dice outcomes:");

        const probabilities = this.calculateProbabilities();
        this.displayProbabilityTable(probabilities);
    }

    calculateProbabilities() {
        const probabilities = [];

        for (let i = 0; i < this.diceSets.length; i++) {
            probabilities[i] = [];
            for (let j = 0; j < this.diceSets.length; j++) {
                if (i === j) {
                    probabilities[i][j] = "-"; // Same dice
                } else {
                    probabilities[i][j] = this.simulateWinProbability(this.diceSets[i], this.diceSets[j]);
                }
            }
        }

        return probabilities;
    }

    simulateWinProbability(diceA, diceB) {
        let wins = 0;
        const totalRounds = diceA.length * diceB.length;

        for (const faceA of diceA) {
            for (const faceB of diceB) {
                if (faceA > faceB) wins++;
            }
        }

        return (wins / totalRounds).toFixed(4); // Probability rounded to 4 decimal places
    }

    displayProbabilityTable(probabilities) {
        const headers = this.diceSets.map(set => set.join(","));

        console.log("Probability of the win for the user:");
        console.log(
            "+-------------+" + headers.map(() => "-------------+").join("")
        );
        console.log(
            "| User dice v | " + headers.map(h => h.padEnd(11)).join(" | ") + " |"
        );
        console.log(
            "+-------------+" + headers.map(() => "-------------+").join("")
        );

        probabilities.forEach((row, i) => {
            const rowHeader = headers[i].padEnd(11);
            const rowContent = row
                .map(p => p.toString().padEnd(11))
                .join(" | ");
            console.log(`| ${rowHeader} | ${rowContent} |`);
        });

        console.log(
            "+-------------+" + headers.map(() => "-------------+").join("")
        );
    }

    getUserInput(validInputs, prompt) {
        const readlineSync = require('readline-sync');
        let input;
        do {
            input = readlineSync.question(prompt);
            if (!validInputs.includes(input)) {
                console.log("Invalid input. Try again.");
            }
        } while (!validInputs.includes(input));
        return input;
    }

    start() {
        this.promptFirstMove();
        if (this.firstPlayer === 1) {
            this.selectDice(1); // Computer selects first
            this.selectDice(0); // User selects second
        } else {
            this.selectDice(0); // User selects first
            this.selectDice(1); // Computer selects second
        }
        this.playRound();
    }
}

// Main program
try {
    const args = process.argv.slice(2);
    const game = new DiceGame(args);
    game.start();
} catch (error) {
    console.error(error.message);
    console.log("Usage: node game.js <dice_set_1> <dice_set_2> <dice_set_3> ...");
    console.log("Each dice set must be a comma-separated list of integers, e.g., '2,4,6,8'.");
}

