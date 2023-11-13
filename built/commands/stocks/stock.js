"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chartjs_node_canvas_1 = require("chartjs-node-canvas");
const db_objects_1 = require("../../database/db-objects");
const utilities_1 = require("../../utilities");
const discord_js_1 = require("discord.js");
const luxon_1 = require("luxon");
const index_1 = require("../../index");
const STOCK_LIST_ID = 'stock';
const STOCK_LIST_PAGE_SIZE = 5;
const width = 3000;
const height = 1400;
const backgroundColour = "white";
const data = {
    command_id: 'stock',
    description: `View the stock list or a stock chart`,
    usage: `${(0, discord_js_1.inlineCode)("$stock")}\n${(0, discord_js_1.inlineCode)("$stock [@user]")}\n${(0, discord_js_1.inlineCode)("$stock [@user] [now/hour/day/month]")}`,
    cooldown_time: 0,
    is_admin: false
};
exports.default = {
    data: data,
    async execute(message, args) {
        if (message.mentions.users.first()) {
            try {
                await sendStockChart(message, args);
            }
            catch (error) {
                console.error(error);
                await message.reply('An error occurred when getting this stock. Please try again later.');
            }
        }
        else {
            try {
                let pageNum = +(0, utilities_1.findNumericArgs)(args)[0] || 1;
                await sendStockList(message, STOCK_LIST_ID, STOCK_LIST_PAGE_SIZE, pageNum);
            }
            catch (error) {
                console.error(error);
                await message.reply('An error occurred when getting the stocks. Please try again later.');
            }
        }
    },
};
async function sendStockChart(message, args) {
    const stockUser = message.mentions.users.first();
    const validIntervals = ['now', 'hour', 'day', 'month'];
    const intervalArg = (0, utilities_1.findTextArgs)(args)[0] ?? 'now';
    const interval = validIntervals.find(vi => vi === intervalArg);
    if (!interval) {
        await message.reply("Invalid interval.");
        return;
    }
    const latestStock = await db_objects_1.Stocks.getLatestStock(stockUser.id);
    if (!latestStock) {
        await message.reply("This stock does not exist.");
        return;
    }
    const stockHistory = await db_objects_1.Stocks.getStockHistory(stockUser.id, interval);
    const initialPrice = stockHistory.length > 0 ? stockHistory[0].price : 0;
    const priceBounds = stockHistory.reduce(({ highest, lowest }, h) => {
        return {
            highest: Math.max(highest, h.price),
            lowest: Math.min(lowest, h.price)
        };
    }, { highest: initialPrice, lowest: initialPrice });
    const highestPrice = Math.round(priceBounds.highest);
    const lowestPrice = Math.round(priceBounds.lowest);
    const previousPrice = stockHistory[stockHistory.length - 2]?.price ?? 0;
    const currentPrice = stockHistory[stockHistory.length - 1]?.price ?? 0;
    const difference = currentPrice - previousPrice;
    const arrow = difference < 0 ?
        utilities_1.STOCKDOWN_EMOJI_CODE :
        utilities_1.STOCKUP_EMOJI_CODE;
    const stockDownColor = "rgb(255, 0, 0)";
    const stockUpColor = "rgb(0, 195, 76)";
    const lineColor = difference < 0 ?
        stockDownColor :
        stockUpColor;
    const volume = await db_objects_1.Stocks.getTotalSharesPurchased(stockUser.id);
    let dateFormat;
    switch (interval) {
        case 'now':
            dateFormat = 'h:mm:ss';
            break;
        case 'hour':
            dateFormat = 'MMM dd, h:mm a';
            break;
        case 'day':
            dateFormat = 'MMM dd';
            break;
        case 'month':
            dateFormat = 'MMM';
            break;
        default:
            dateFormat = 'yyyy-MM-dd';
            break;
    }
    const chartJSNodeCanvas = new chartjs_node_canvas_1.ChartJSNodeCanvas({ width, height, backgroundColour });
    const configuration = {
        type: 'line',
        data: {
            labels: stockHistory.map(h => luxon_1.DateTime.fromISO(h.created_date).toFormat(dateFormat)),
            datasets: [{
                    label: `Stock price (${interval})`,
                    data: stockHistory.map(h => h.price),
                    fill: false,
                    borderColor: lineColor
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
                    min: lowestPrice * .97,
                    max: highestPrice * 1.03,
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
                            size: 60
                        }
                    }
                }
            }
        }
    };
    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    const attachment = new discord_js_1.AttachmentBuilder(image);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor("Blurple")
        .setTitle(`${arrow} ${(0, discord_js_1.inlineCode)(stockUser.username)} - ${utilities_1.CURRENCY_EMOJI_CODE} ${(0, utilities_1.formatNumber)(currentPrice)}`)
        .setDescription(`High: ${utilities_1.CURRENCY_EMOJI_CODE} ${(0, utilities_1.formatNumber)(highestPrice)}\nLow: ${utilities_1.CURRENCY_EMOJI_CODE} ${(0, utilities_1.formatNumber)(lowestPrice)}\nVolume: :bar_chart: ${(0, utilities_1.formatNumber)(volume)}`)
        .setImage('attachment://chart.png');
    await message.reply({ embeds: [embed], files: [attachment] });
}
async function sendStockList(message, id, pageSize = 5, pageNum = 1) {
    const startIndex = (pageNum - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const stocks = await db_objects_1.Stocks.getLatestStocks();
    const slicedStocks = stocks.slice(startIndex, endIndex);
    // getting the 'now' stock history pulls from a cache
    const histories = await Promise.all(stocks.map(s => db_objects_1.Stocks.getStockHistory(s.stock_id, 'now')));
    const totalPages = Math.ceil(stocks.length / pageSize);
    const paginatedMenu = new utilities_1.PaginatedMenuBuilder(id, pageSize, pageNum, totalPages)
        .setColor('Blurple')
        .setTitle('Stocks :chart_with_upwards_trend:')
        .setDescription(`To view additional info: ${(0, discord_js_1.inlineCode)("$stock @user")}.`);
    let i = 0;
    for (const stock of slicedStocks) {
        const previousPrice = histories[i][1]?.price ?? 0;
        const currentPrice = stock.price;
        const username = (await message.client.users.fetch(stock.stock_id)).username;
        const arrow = (currentPrice - previousPrice) < 0 ?
            utilities_1.STOCKDOWN_EMOJI_CODE :
            utilities_1.STOCKUP_EMOJI_CODE;
        paginatedMenu.addFields({
            name: `${arrow} ${(0, discord_js_1.inlineCode)(username)} - ${utilities_1.CURRENCY_EMOJI_CODE} ${(0, utilities_1.formatNumber)(stock.price)}`,
            value: `${"Previous tick:"} ${utilities_1.CURRENCY_EMOJI_CODE} ${(0, utilities_1.formatNumber)(previousPrice)}`
        });
        ++i;
    }
    ;
    const embed = paginatedMenu.createEmbed();
    const buttons = paginatedMenu.createButtons();
    message instanceof discord_js_1.ButtonInteraction ?
        await message.update({ embeds: [embed], components: [buttons] }) :
        await message.reply({ embeds: [embed], components: [buttons] });
}
index_1.client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    try {
        if (!interaction.isButton()) {
            return;
        }
        const { customId } = interaction;
        if (![`${STOCK_LIST_ID}Previous`, `${STOCK_LIST_ID}Next`].includes(customId))
            return;
        const authorId = interaction.message.mentions.users.first().id;
        if (interaction.user.id !== authorId)
            return;
        let pageNum = parseInt(interaction.message.embeds[0].description.match(/Page (\d+)/)[1]);
        pageNum = (customId === `${STOCK_LIST_ID}Previous`) ?
            pageNum = Math.max(pageNum - 1, 1) :
            pageNum + 1;
        await sendStockList(interaction, STOCK_LIST_ID, STOCK_LIST_PAGE_SIZE, pageNum);
    }
    catch (error) {
        console.error(error);
    }
});
