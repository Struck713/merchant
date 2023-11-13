import { Users, Items, Stocks } from '../../database/db-objects';
import { CURRENCY_EMOJI_CODE, formatNumber, findNumericArgs, findTextArgs } from '../../utilities';
import { Commands as Command, CommandsCommandId } from '../../database/schemas/public/Commands';
import { Message, EmbedBuilder, inlineCode } from 'discord.js';

const data: Command = {
    command_id: 'buy' as CommandsCommandId,
    description: `Buy an item or stock`,
    usage: `${inlineCode("$buy [item/@user]")}\n${inlineCode("$buy [item/@user] [#amount/all]")}`,
    cooldown_time: 0,
    is_admin: false
};

export default {
    data: data,
    async execute(message: Message, args: string[]): Promise<void> {
        if (message.mentions.users.size === 1) {
            try {
                await buyStock(message, args);
            }
            catch (error) {
                console.error(error);
                await message.reply('An error occurred when buying this stock. Please try again later.');
            }
        }
        else {
            try {
                await buyItem(message, args);
            }
            catch (error) {
                console.error(error);
                await message.reply('An error occurred when buying this item. Please try again later.');
            }
        }
    }
};

async function buyStock(message: Message, args: string[]): Promise<void> {
    const stockUser = message.mentions.users.first();
    const quantity: number = args.includes("all") ?
        99999 :
        (+findNumericArgs(args)[0] || 1);

    if (!Number.isInteger(quantity)) {
        await message.reply(`You can only purchase a whole number of shares.`);
        return;
    }

    if (quantity <= 0) {
        await message.reply(`You can only purchase one or more shares.`);
        return;
    }

    if (message.author.id === stockUser.id) {
        await message.reply(`You cannot own your own stock.`);
        return;
    }

    const latestStock = await Stocks.getLatestStock(stockUser.id);

    if (!latestStock) {
        await message.reply(`That stock does not exist.`);
        return;
    }

    const authorBalance: number = await Users.getBalance(message.author.id);
    // buy as many as possible
    const totalBought: number = ((latestStock.price * quantity) > authorBalance || args.includes('all')) ?
        Math.floor(Math.floor((authorBalance / latestStock.price) * 100) / 100) :
        quantity;
    const totalCost: number = latestStock.price * totalBought;

    await Users.addStock(message.author.id, stockUser.id, totalBought);
    await Users.addBalance(message.author.id, -(totalCost));

    const pluralS: string = quantity > 1 ? "s" : "";
    const embed = new EmbedBuilder()
        .setColor('Blurple')
        .addFields({
            name: `${formatNumber(totalBought)} share${pluralS} of ${inlineCode(stockUser.tag)} bought for ${CURRENCY_EMOJI_CODE} ${formatNumber(totalCost)}`,
            value: ' '
        });

    await message.reply({ embeds: [embed] });
}

async function buyItem(message: Message, args: string[]): Promise<void> {
    const itemName: string = findTextArgs(args)[0]?.toLowerCase() === 'all' ?
        findTextArgs(args)[1]?.toLowerCase() :
        findTextArgs(args)[0]?.toLowerCase();

    const quantity: number = args.includes("all") ?
        99999 :
        (+findNumericArgs(args)[0] || 1);

    if (!itemName) {
        await message.reply(`Please specify an item or stock.`);
        return;
    }

    const item = await Items.get(itemName);

    if (!item) {
        await message.reply(`That item doesn't exist.`);
        return;
    }

    if (!Number.isInteger(quantity)) {
        await message.reply(`You can only purchase a whole number of items.`);
        return;
    }

    if (quantity <= 0) {
        await message.reply(`You can only purchase one or more items.`);
        return;
    }

    // TODO: move to json parameter file?
    const MAX_ITEM_COUNT: number = 5;
    const itemCount: number = await Users.getItemCount(message.author.id);
    const freeInventorySpace = MAX_ITEM_COUNT - itemCount;

    if (freeInventorySpace <= 0) {
        await message.reply(`You can only store ${MAX_ITEM_COUNT} items at a time.`);
        return;
    }
    // if (user.role < item.role) return message.reply(`Your role is too low to buy this item.`);
    // buy as many as possible
    const authorBalance: number = await Users.getBalance(message.author.id);
    let totalBought: number = ((item.price * quantity) > authorBalance || args.includes('all')) ?
        Math.floor(Math.floor((authorBalance / item.price) * 100) / 100) :
        quantity;
    // Dont exceed max inventory size
    totalBought = (totalBought > freeInventorySpace) ?
        freeInventorySpace :
        totalBought;

    if (!totalBought) {
        await message.reply(`You are too poor to purchase this item.`);
        return;
    }

    const totalCost: number = item.price * totalBought;

    await Users.addItem(message.author.id, itemName, totalBought);
    await Users.addBalance(message.author.id, -totalCost);

    const pluralS = totalBought > 1 ?
        "s" :
        "";

    const embed = new EmbedBuilder()
        .setColor("Blurple")
        .addFields({
            name: `${formatNumber(totalBought)} ${item.emoji_code} ${item.item_id}${pluralS} bought for ${CURRENCY_EMOJI_CODE} ${formatNumber(totalCost)}`,
            value: ' '
        });
    await message.reply({ embeds: [embed] });
}
