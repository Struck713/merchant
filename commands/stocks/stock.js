const { EmbedBuilder, inlineCode, AttachmentBuilder } = require('discord.js');
const { tendieIconCode } = require("../../utilities.js");
const { getLatestStock, getStockHistory, latestStocksCache } = require("../../database/utilities/stockUtilities.js");
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const moment = require('moment');

const width = 2000;
const height = 1000;
const backgroundColour = "white";

module.exports = {
    data: {
        name: 'stock',
        description: 'View stocks.'
    },
    async execute(message, args) {
        if (message.mentions.users.first()) {
            try {
                handleChartReply(message, args);
            } catch (error) {
                console.error("Error handling chart reply: ", error);
            }
        } else {
            try {
                handleListReply(message, args);
            } catch (error) {
                console.error("Error handling list reply: ", error);
            }
        }
    },
};

async function handleChartReply(message, args) {
    const stockUser = message.mentions.users.first();
    const interval = args[1] ?? "hour";
    const intervals = ['hour', 'day', 'month'];
    if (!intervals.includes(interval) && args[1]){
        return message.reply("Invalid interval.");
    }
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour });
    const stockHistory = (await getStockHistory(stockUser.id, interval)).reverse();
    const currentStock = await getLatestStock(stockUser.id);

    if (!currentStock) {
        return message.reply("This stock does not exist.");
    }

    const highestPrice = Math.round(Math.max(...stockHistory.map(h => h.dataValues.price)));
    const lowestPrice = Math.round(Math.min(...stockHistory.map(h => h.dataValues.price)));
    const previousPrice = stockHistory[stockHistory.length - 2]?.price ?? 0;
    const currentPrice = stockHistory[stockHistory.length - 1]?.price ?? 0;
    const difference = currentPrice - previousPrice;

    let arrow = "<:stockup:1117496842867982407>";
    let lineColor = "rgb(0, 195, 76)";

    if (difference < 0) {
        arrow = "<:stockdown:1117496855870328833>";
        lineColor = "rgb(255, 0, 0)";
    }
    const embed = new EmbedBuilder()
        .setColor("Blurple")
        .setTitle(`${arrow} ${inlineCode(stockUser.username)} - ${tendieIconCode} ${currentPrice}`)
        .setDescription(`High: ${tendieIconCode} ${highestPrice}\nLow: ${tendieIconCode} ${lowestPrice}\nVolume: :bar_chart: ${currentStock.purchased_shares}`);

    const dateFormat = interval === 'hour' ? 'h:mm a' : interval === 'day' ? 'MMM DD' : 'MMM';

    const configuration = {
        type: 'line',
        data: {
            labels: stockHistory.map(h => moment(h.dataValues[interval]).format(dateFormat)),
            datasets: [{
                label: `Stock price (${interval})`,
                data: stockHistory.map(h => h.price),
                fill: false,
                borderColor: lineColor,
                lineTension: 0.1
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 33
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: 36
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 60 // this controls the font size of the legend labels
                        }
                    }
                }
            }
        }
    };

    embed.setImage('attachment://chart.png');
    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    const attachment = new AttachmentBuilder(image, 'chart.png');
    return message.reply({ embeds: [embed], files: [attachment] });
}


async function handleListReply(message, args) {
    const pageNum = args.find(arg => !isNaN(arg)) ?? 1;
    const pageSize = 5;
    const startIndex = (pageNum - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const stocks = Array.from(latestStocksCache.values()).slice(startIndex, endIndex);

    const totalPages = Math.ceil(latestStocksCache.size / pageSize);

    const embed = new EmbedBuilder()
        .setColor("Blurple")
        .setTitle("Stocks :chart_with_upwards_trend:")
        .setDescription(`Page ${pageNum}/${totalPages}\nTo view additional info on a stock: ${inlineCode("$stock @user")}`);

    // Fetch all users, histories and latest stocks in parallel
    const usersPromise = Promise.all(stocks.map(s => message.client.users.fetch(s.user_id)));
    const historiesPromise = Promise.all(stocks.map(s => getStockHistory(s.user_id)));
    const latestStocksPromise = Promise.all(stocks.map(s => getLatestStock(s.user_id)));

    const [users, histories, latestStocks] = await Promise.all([usersPromise, historiesPromise, latestStocksPromise]);

    users.forEach((user, i) => {
        if (!latestStocks[i]) {
            return console.error("This stock does not exist");
        }

        const previousPrice = histories[i][1]?.price ?? 0;
        const currentPrice = latestStocks[i].price;

        const arrow = (currentPrice - previousPrice) < 0 ?
            "<:stockdown:1117496855870328833>" :
            "<:stockup:1117496842867982407>";

        embed.addFields({ name: `${arrow} ${inlineCode(user.username)} - ${tendieIconCode} ${stocks[i].price}`, value: `${"Previous:"} ${tendieIconCode} ${previousPrice}` });
    });

    return message.reply({ embeds: [embed] });
}


