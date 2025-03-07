import { StocksFactory } from "../../database/db-objects";
import { Message, userMention, EmbedBuilder, inlineCode } from "discord.js";
import { CURRENCY_EMOJI_CODE, findNumericArgs } from "../../utilities";
import {
    Commands as Command,
    CommandsCommandId,
} from "../../database/schemas/public/Commands";

const data: Partial<Command> = {
    command_id: "setprice" as CommandsCommandId,
    description: `Set a stock price`,
    usage: `${inlineCode("$setprice [@user] [#amount]")}`,
    cooldown_time: 0,
    is_admin: true,
};

export default {
    data: data,
    async execute(message: Message, args: string[]): Promise<void> {
        const Stocks = StocksFactory.get(message.guildId);

        const stockUser = message.mentions.members.first();
        const newPrice: number = +findNumericArgs(args);

        if (!newPrice) {
            throw new Error("Please specify a price.");
        }

        await Stocks.updateStockPrice(stockUser.id, newPrice);

        const embed = new EmbedBuilder().setColor("Blurple").setFields({
            name: `${inlineCode(userMention(stockUser.id))}'s price set to: ${CURRENCY_EMOJI_CODE} ${newPrice}`,
            value: ` `,
        });
        await message.reply({ embeds: [embed] });
    },
};
