import QuickChart from "quickchart-js";
import { StocksFactory, UsersFactory } from "../../database/db-objects";
import {
    CURRENCY_EMOJI_CODE,
    STOCKDOWN_EMOJI_CODE,
    STOCKUP_EMOJI_CODE,
    formatNumber,
    findNumericArgs,
    findTextArgs,
    PaginatedMenuBuilder,
    client,
} from "../../utilities";
import {
    Message,
    EmbedBuilder,
    AttachmentBuilder,
    inlineCode,
    Events,
    ButtonInteraction,
} from "discord.js";
import {
    Commands as Command,
    CommandsCommandId,
} from "../../database/schemas/public/Commands";
import { DateTime } from "luxon";
import { ChartConfiguration } from "chart.js";
import { StockInterval } from "../../database/datastores/Stocks";

const STOCK_LIST_ID: string = "stock";
const STOCK_LIST_PAGE_SIZE: number = 5;

const data: Partial<Command> = {
    command_id: "stock" as CommandsCommandId,
    description: `View the stock list or a stock chart`,
    usage: `${inlineCode("$stock")}\n${inlineCode("$stock [@user]")}\n${inlineCode("$stock [@user] [now/hour/day/month]")}`,
    cooldown_time: 0,
    is_admin: false,
};

export default {
    data: data,
    async execute(message: Message, args: string[]): Promise<void> {
        if (message.mentions.users.first()) {
            await sendStockChart(message, args);
        } else {
            let pageNum: number = +findNumericArgs(args)[0] || 1;
            await sendStockList(
                message,
                STOCK_LIST_ID,
                STOCK_LIST_PAGE_SIZE,
                pageNum,
            );
        }
    },
};

async function sendStockChart(message: Message, args: string[]): Promise<void> {
    const Stocks = StocksFactory.get(message.guildId);

    const stockUser = message.mentions.users.first();
    const validIntervals: StockInterval[] = ["minute", "hour", "day", "month"];
    const intervalArg = findTextArgs(args)[0] ?? "minute";
    const interval: StockInterval | undefined = validIntervals.find(
        (vi) => vi === intervalArg,
    );

    if (!interval) {
        throw new Error("Invalid interval.");
    }

    const latestStock = await Stocks.get(stockUser.id);
    if (!latestStock) {
        throw new Error("This stock does not exist.");
    }

    const stockHistory = (await Stocks.getStockHistory(stockUser.id, interval)).reverse();
    const initialPrice = stockHistory.length > 0 ? stockHistory[0].price : 0;
    const priceBounds = stockHistory.reduce(
        ({ highest, lowest }, h) => {
            return {
                highest: Math.max(highest, h.price),
                lowest: Math.min(lowest, h.price),
            };
        },
        { highest: initialPrice, lowest: initialPrice },
    );

    const highestPrice: number = Math.round(priceBounds.highest);
    const lowestPrice: number = Math.round(priceBounds.lowest);

    const previousPrice: number =
        stockHistory[stockHistory.length - 2]?.price ?? 0;
    const currentPrice: number =
        stockHistory[stockHistory.length - 1]?.price ?? 0;
    const difference: number = currentPrice - previousPrice;

    const arrow = difference < 0 ? STOCKDOWN_EMOJI_CODE : STOCKUP_EMOJI_CODE;

    const stockDownColor: string = "rgb(255, 0, 0)";
    const stockUpColor: string = "rgb(0, 195, 76)";
    const lineColor: string = difference < 0 ? stockDownColor : stockUpColor;

    const volume = await Stocks.getTotalSharesPurchased(stockUser.id);

    let dateFormat: string;
    switch (interval) {
        case "minute":
            dateFormat = "h:mm:ss";
            break;
        case "hour":
            dateFormat = "MMM dd, h:mm a";
            break;
        case "day":
            dateFormat = "MMM dd";
            break;
        case "month":
            dateFormat = "MMM";
            break;
        default:
            dateFormat = "yyyy-MM-dd";
            break;
    }

    const configuration: ChartConfiguration = {
        type: "line",
        data: {
            labels: stockHistory
                .map((h) => DateTime.fromSQL(h.created_date).toFormat(dateFormat)),
            datasets: [
                {
                    label: `Stock price (${interval})`,
                    data: stockHistory.map((h) => h.price),
                    fill: false,
                    borderColor: lineColor,
                    borderWidth: 4,
                    pointBackgroundColor: lineColor,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 24,
                        },
                        color: "#ffffff",
                    },
                    grid: {
                        display: false,
                    },
                },
                y: {
                    min: lowestPrice * 0.95,
                    max: highestPrice * 1.05,
                    ticks: {
                        font: {
                            size: 24,
                        },
                        color: "#cccccc",
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.1)",
                    },
                },
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 30,
                        },
                        color: "#ffffff",
                    },
                },
            },
            elements: {
                line: {
                    tension: 0.4, // smoothing
                },
            },
        },
    };

    const chart = new QuickChart();
    chart.setConfig(configuration)
        .setWidth(1200)
        .setHeight(600)
    const attachment = new AttachmentBuilder((await chart.toBinary()));

    const embed = new EmbedBuilder()
        .setColor("Blurple")
        .setTitle(
            `${arrow} ${inlineCode(stockUser.username)} - ${CURRENCY_EMOJI_CODE} ${formatNumber(currentPrice)}`,
        )
        .setDescription(
            `High: ${CURRENCY_EMOJI_CODE} ${formatNumber(highestPrice)}\nLow: ${CURRENCY_EMOJI_CODE} ${formatNumber(lowestPrice)}\nVolume: :bar_chart: ${formatNumber(volume)}`,
        )
        .setImage("attachment://chart.png");

    await message.reply({ embeds: [embed], files: [attachment] });
}

async function sendStockList(
    message: Message | ButtonInteraction,
    id: string,
    pageSize: number = 5,
    pageNum: number = 1,
): Promise<void> {
    const Users = UsersFactory.get(message.guildId);
    const Stocks = StocksFactory.get(message.guildId);

    const startIndex: number = (pageNum - 1) * pageSize;
    const endIndex: number = startIndex + pageSize;

    const stocks = await Stocks.getAll();
    const slicedStocks = stocks.slice(startIndex, endIndex);

    // getting the 'minute' stock history pulls from a cache
    const histories = await Promise.all(
        stocks.map((s) => Stocks.getStockHistory(s.stock_id, "minute")),
    );

    const totalPages = Math.ceil(stocks.length / pageSize);
    const paginatedMenu = new PaginatedMenuBuilder(
        id,
        pageSize,
        pageNum,
        totalPages,
    )
        .setColor("Blurple")
        .setTitle("Stocks :chart_with_upwards_trend:")
        .setDescription(
            `To view additional info: ${inlineCode("$stock @user")}.`,
        );

    let i = 0;
    for (const stock of slicedStocks) {
        const previousPrice = histories[i++][1]?.price ?? 0;
        const currentPrice = stock.price;
        const stockUser = await Users.get(stock.stock_id);
        const arrow =
            currentPrice - previousPrice < 0
                ? STOCKDOWN_EMOJI_CODE
                : STOCKUP_EMOJI_CODE;

        paginatedMenu.addFields({
            name: `${arrow} ${inlineCode(stockUser.username)} - ${CURRENCY_EMOJI_CODE} ${formatNumber(stock.price)}`,
            value: `${"Previous tick:"} ${CURRENCY_EMOJI_CODE} ${formatNumber(previousPrice)}`,
        });
    }

    const embed = paginatedMenu.createEmbed();
    const buttons = paginatedMenu.createButtons();

    message instanceof ButtonInteraction
        ? await message.update({ embeds: [embed], components: [buttons] })
        : await message.reply({ embeds: [embed], components: [buttons] });
}

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (!interaction.isButton()) {
            return;
        }

        const { customId } = interaction;

        if (
            ![`${STOCK_LIST_ID}Previous`, `${STOCK_LIST_ID}Next`].includes(
                customId,
            )
        )
            return;

        const authorId = interaction.message.mentions.users.first().id;
        if (interaction.user.id !== authorId) return;

        let pageNum = parseInt(
            interaction.message.embeds[0].description.match(/Page (\d+)/)[1],
        );
        pageNum =
            customId === `${STOCK_LIST_ID}Previous`
                ? (pageNum = Math.max(pageNum - 1, 1))
                : pageNum + 1;

        await sendStockList(
            interaction,
            STOCK_LIST_ID,
            STOCK_LIST_PAGE_SIZE,
            pageNum,
        );
    } catch (error) {
        console.error(error);
    }
});
