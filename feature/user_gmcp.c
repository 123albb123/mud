#define GMCP_LOG 50
#define GMCP_ITEMS_VERSION 1

nosave string *gmcp_log = ({});
private nosave mapping gmcp_room_ids = ([]);
private nosave string gmcp_room_session;
private nosave int gmcp_room_sequence;
private nosave mapping gmcp_item_ids = ([]);
private nosave string gmcp_item_session;
private nosave int gmcp_item_sequence;
private nosave int gmcp_inventory_revision;
private nosave int gmcp_equipment_revision;
private nosave string gmcp_inventory_fingerprint;
private nosave string gmcp_equipment_fingerprint;
private nosave mapping gmcp_support_versions = ([]);

varargs void sendGMCP(mapping data, mixed *modules...);

private string query_gmcp_room_id(object room)
{
    string key;

    if (!objectp(room))
        return "";

    if (!mapp(gmcp_room_ids))
        gmcp_room_ids = ([]);
    if (!stringp(gmcp_room_session))
        gmcp_room_session = sprintf("%08x", random(0x7fffffff));

    key = file_name(room);
    if (!stringp(gmcp_room_ids[key]))
    {
        gmcp_room_sequence++;
        gmcp_room_ids[key] = sprintf("r-%s-%04d",
                                     gmcp_room_session,
                                     gmcp_room_sequence);
    }

    return gmcp_room_ids[key];
}

private string query_gmcp_item_id(object item)
{
    string key;

    if (!objectp(item))
        return "";

    if (!mapp(gmcp_item_ids))
        gmcp_item_ids = ([]);
    if (!stringp(gmcp_item_session))
        gmcp_item_session = sprintf("%08x", random(0x7fffffff));

    key = file_name(item);
    if (!stringp(gmcp_item_ids[key]))
    {
        gmcp_item_sequence++;
        gmcp_item_ids[key] = sprintf("i-%s-%04d",
                                     gmcp_item_session,
                                     gmcp_item_sequence);
    }

    return gmcp_item_ids[key];
}

private int gmcp_item_is(object item, string method)
{
    mixed result;

    if (!objectp(item) || !stringp(method) || !function_exists(method, item))
        return 0;
    if (catch(result = call_other(item, method)))
        return 0;
    return result ? 1 : 0;
}

private string gmcp_item_text(mixed value)
{
    string text;

    if (!stringp(value))
        return "";
    text = remove_ansi(value);
    text = replace_string(text, "\r", "");
    return replace_string(text, "\n", "");
}

private string gmcp_item_command_id(object item)
{
    mixed ids;
    mixed value;
    string id;
    int i;

    if (function_exists("parse_command_id_list", item) &&
        !catch(ids = item->parse_command_id_list()) && pointerp(ids))
    {
        for (i = 0; i < sizeof(ids); i++)
        {
            value = ids[i];
            if (stringp(value) && value != "")
                return gmcp_item_text(value);
        }
    }

    if (catch(id = item->query("id")) || !stringp(id))
        id = "";
    return gmcp_item_text(id);
}

private int gmcp_item_amount(object item)
{
    mixed value;

    if (function_exists("query_amount", item) &&
        !catch(value = item->query_amount()) && intp(value) && value > 0)
        return value;
    return 1;
}

private int gmcp_item_weight(object item)
{
    mixed value;

    if (function_exists("query_weight", item) &&
        !catch(value = item->query_weight()) && intp(value))
        return value;
    return 0;
}

private string gmcp_item_category(object item)
{
    if (gmcp_item_is(item, "is_weapon"))
        return "weapon";
    if (gmcp_item_is(item, "is_armor"))
        return "armor";
    if (gmcp_item_is(item, "is_food"))
        return "food";
    if (gmcp_item_is(item, "is_liquid"))
        return "liquid";
    if (gmcp_item_is(item, "is_container"))
        return "container";
    if (gmcp_item_is(item, "is_book"))
        return "book";
    if (gmcp_item_is(item, "is_money"))
        return "money";
    if (gmcp_item_is(item, "is_charm"))
        return "charm";
    if (gmcp_item_is(item, "is_rune"))
        return "rune";
    if (gmcp_item_is(item, "is_inlaid"))
        return "inlaid";
    if (gmcp_item_is(item, "is_task"))
        return "task";
    return "misc";
}

private string gmcp_item_equipped(object item)
{
    mixed value;

    if (catch(value = item->query("equipped")) || !stringp(value))
        return "";
    return value;
}

private mixed *gmcp_item_actions(object item, string command_id, string equipped)
{
    mixed *actions;
    mixed no_drop;
    mixed no_wield;

    actions = ({});
    if (!stringp(command_id) || command_id == "")
        return actions;

    actions += ({(["id": "look", "command": "look " + command_id])});
    if (equipped == "wielded")
    {
        actions += ({(["id": "unwield", "command": "unwield " + command_id])});
        return actions;
    }
    if (equipped == "worn")
    {
        actions += ({(["id": "remove", "command": "remove " + command_id])});
        return actions;
    }

    no_drop = item->query("no_drop");
    if (!no_drop)
        actions += ({(["id": "drop", "command": "drop " + command_id])});

    if (gmcp_item_is(item, "is_food") || item->query("only_do_effect"))
        actions += ({(["id": "eat", "command": "eat " + command_id])});
    if (gmcp_item_is(item, "is_liquid") || mapp(item->query("liquid")))
        actions += ({(["id": "drink", "command": "drink " + command_id])});

    no_wield = item->query("no_wield");
    if (gmcp_item_is(item, "is_weapon") && !no_wield)
        actions += ({(["id": "wield", "command": "wield " + command_id])});
    if (gmcp_item_is(item, "is_armor"))
        actions += ({(["id": "wear", "command": "wear " + command_id])});

    return actions;
}

private mapping gmcp_inventory_item(object item)
{
    string command_id;
    string equipped;
    string unit;
    string name;
    mapping record;
    mixed value;

    if (!objectp(item))
        return 0;

    name = gmcp_item_text(item->name());
    if (name == "")
        name = gmcp_item_text(item->short());
    command_id = gmcp_item_command_id(item);
    equipped = gmcp_item_equipped(item);
    value = item->query("unit");
    unit = stringp(value) ? gmcp_item_text(value) : "";
    record = ([
        "item_id"   : query_gmcp_item_id(item),
        "name"      : name,
        "command_id": command_id,
        "amount"    : gmcp_item_amount(item),
        "unit"      : unit,
        "weight"    : gmcp_item_weight(item),
        "category"  : gmcp_item_category(item),
        "equipped"  : equipped != "",
        "actions"   : gmcp_item_actions(item, command_id, equipped),
    ]);
    return record;
}

private mapping gmcp_inventory_snapshot()
{
    object *items;
    mixed *records;
    mapping record;
    int i;

    items = all_inventory(this_object());
    records = ({});
    for (i = 0; i < sizeof(items); i++)
    {
        record = gmcp_inventory_item(items[i]);
        if (mapp(record))
            records += ({record});
    }

    return ([
        "version" : GMCP_ITEMS_VERSION,
        "snapshot": 1,
        "revision": gmcp_inventory_revision,
        "sequence": gmcp_inventory_revision,
        "items"   : records,
    ]);
}

private string *gmcp_equipment_slot_order()
{
    // These are the armor_type values used by include/armor.h and existing
    // project objects; feet and bandage are retained for legacy objects.
    return ({
        "weapon", "secondary_weapon", "head", "neck", "cloth", "armor",
        "surcoat", "waist", "wrists", "hands", "finger", "boots", "feet",
        "shield", "charm", "bandage",
    });
}

private mapping gmcp_equipment_snapshot()
{
    object *items;
    object secondary_weapon;
    mixed *records;
    mapping item_record;
    mapping record;
    string equipped;
    string slot;
    int i;

    secondary_weapon = this_object()->query_temp("secondary_weapon");
    items = all_inventory(this_object());
    records = ({});

    for (i = 0; i < sizeof(items); i++)
    {
        equipped = gmcp_item_equipped(items[i]);
        if (equipped == "")
            continue;

        if (equipped == "wielded")
        {
            if (objectp(secondary_weapon) && items[i] == secondary_weapon)
                slot = "secondary_weapon";
            else
                slot = "weapon";
        }
        else if (equipped == "worn")
        {
            slot = items[i]->query("armor_type");
            if (!stringp(slot) || slot == "")
                slot = "armor";
        }
        else
            continue;

        item_record = gmcp_inventory_item(items[i]);
        if (!mapp(item_record))
            continue;
        record = ([
            "slot"      : slot,
            "item_id"   : item_record["item_id"],
            "name"      : item_record["name"],
            "command_id": item_record["command_id"],
            "type"      : item_record["category"],
            "actions"   : item_record["actions"],
        ]);
        records += ({record});
    }

    return ([
        "version"   : GMCP_ITEMS_VERSION,
        "snapshot"  : 1,
        "revision"  : gmcp_equipment_revision,
        "sequence"  : gmcp_equipment_revision,
        "slot_order": gmcp_equipment_slot_order(),
        "slots"     : records,
    ]);
}

private string gmcp_snapshot_fingerprint(mixed value)
{
    string result;

    if (catch(result = json_encode(value)))
        return "";
    return result;
}

varargs void gmcp_refresh_items(int force)
{
    mapping inventory;
    mapping equipment;
    string inventory_fingerprint;
    string equipment_fingerprint;
    int send_inventory;
    int send_equipment;

    if (!has_gmcp())
        return;

    inventory = gmcp_inventory_snapshot();
    equipment = gmcp_equipment_snapshot();
    inventory_fingerprint = gmcp_snapshot_fingerprint(inventory["items"]);
    equipment_fingerprint = gmcp_snapshot_fingerprint(equipment["slots"]);
    send_inventory = force || inventory_fingerprint != gmcp_inventory_fingerprint;
    send_equipment = force || equipment_fingerprint != gmcp_equipment_fingerprint;

    if (send_inventory)
    {
        gmcp_inventory_revision++;
        inventory["revision"] = gmcp_inventory_revision;
        inventory["sequence"] = gmcp_inventory_revision;
        sendGMCP(inventory, "Char", "Inventory");
        gmcp_inventory_fingerprint = inventory_fingerprint;
    }
    if (send_equipment)
    {
        gmcp_equipment_revision++;
        equipment["revision"] = gmcp_equipment_revision;
        equipment["sequence"] = gmcp_equipment_revision;
        sendGMCP(equipment, "Char", "Equipment");
        gmcp_equipment_fingerprint = equipment_fingerprint;
    }
}

int gmcp_item_command(string verb)
{
    if (!stringp(verb))
        return 0;

    // The command implementation remains authoritative. Defer the re-read
    // until the next driver tick so a destructed or split item is no longer
    // present in the current command's inventory view.
    switch (verb)
    {
    case "get":
    case "drop":
    case "give":
    case "put":
    case "eat":
    case "drink":
    case "wield":
    case "unwield":
    case "wear":
    case "remove":
    case "buy":
    case "sell":
        call_out("gmcp_refresh_items", 0);
        return 1;
    }
    return 0;
}

// msp_oob("!!SOUND(10001.wav L=1 V=100 U=https://mud.ren/storage/wav/)");
void msp_oob(string req)
{
#if efun_defined(telnet_msp_oob)
    efun::telnet_msp_oob(req);
#else
    receive("<当前驱动不支持efun telnet_msp_oob()>\n");
#endif
}

protected int dump_gmcp_log()
{
    write(implode(gmcp_log, "\n") + "\n");
    return 1;
}

private void log_gmcp(string msg)
{
    gmcp_log = gmcp_log[ < GMCP_LOG..] + ({msg});
}

void send_gmcp(string gmcp)
{
    efun::send_gmcp(gmcp);
}

varargs void sendGMCP(mapping data, mixed *modules...)
{
    if (!has_gmcp())
        return;

    if (!mapp(data) || !sizeof(modules))
    {
        return;
    }
    else
    {
        string msg = implode(modules, ".");
        catch (msg += " " + json_encode(data));
        log_gmcp("Sending: " + msg);
        send_gmcp(msg);
    }
}

private void gmcp_enable()
{
    message("system", "<GMCP negotiation enabled>\n", this_object());
    sendGMCP(([
        "mud_name": MUD_NAME,
        "protocol": "yanhuang-gmcp",
        "version" : GMCP_ITEMS_VERSION,
        "supports": ([
            "Char.Vitals"    : 1,
            "Room.Info"      : 1,
            "Char.Inventory" : GMCP_ITEMS_VERSION,
            "Char.Equipment": GMCP_ITEMS_VERSION,
        ]),
    ]), "Core", "Hello");
}

protected void init_gmcp()
{
    if (!has_gmcp())
        return;
    gmcp_enable();

    // Mudlet Client
    if (env("GUI"))
    {
        sendGMCP((["version":env("GUI.version"), "url":env("GUI.url")]), "Client", "GUI");
    }
    if (sizeof(env("Map")))
    {
        sendGMCP((["url":env("Map")]), "Client", "Map");
    }

    if (wizardp(this_player()))
    {
        add_action("dump_gmcp_log", "gmcp_log");
    }
}

void gmcp_reconnect()
{
    if (!has_gmcp())
        return;

    gmcp_enable();
    gmcp_refresh_items(1);
}

// gmcp - provides an interface to GMCP data received from the client
void gmcp(string req)
{
    int split;
    string package;
    string payload;
    mapping support_data;

    log_gmcp("Received: " + req);
    split = strsrch(req, " ");
    if (split == -1)
    {
        package = req;
        payload = "";
    }
    else
    {
        package = req[0..split - 1];
        payload = req[split + 1..];
    }

    if (package == "Core.Supports.Set")
    {
        mixed decoded;

        if (!catch(decoded = json_decode(payload)) && mapp(decoded))
        {
            support_data = decoded;
            if (mapp(support_data["packages"]))
                gmcp_support_versions = support_data["packages"];
            else
                gmcp_support_versions = support_data;
        }
        gmcp_refresh_items(1);
    }
    else if (package == "Char.Vitals.Get")
    {
        object ob = this_object();
        mapping my = ob->query_entire_dbase() || ([]);
        // 很奇怪的问题, 得加` || 0`, 否则对0值客户端可能是<userdata 1>
        mapping data = ([
            "hp"         : my["qi"] || 0,
            "max_hp"     : my["max_qi"] || 0,
            "jing"       : my["jing"] || 0,
            "max_jing"   : my["max_jing"] || 0,
            "jingli"     : my["jingli"] || 0,
            "max_jingli" : my["max_jingli"] || 0,
            "neili"      : my["neili"] || 0,
            "max_neili"  : my["max_neili"] || 0,
            "food"       : my["food"] || 0,
            "max_food"   : ob->max_food_capacity(),
            "water"      : my["water"] || 0,
            "max_water"  : ob->max_water_capacity(),
            "exp"        : my["combat_exp"] || 0,
            "pot"        : (int)ob->query("potential") - (int)ob->query("learned_points"),
        ]);
        sendGMCP(data, "Char", "Vitals");
    }
    else if (package == "Room.Info.Get")
    {
        object ob = environment(this_object());
        string room_id;
        mapping room_info;

        if (!objectp(ob))
            return;

        room_id = query_gmcp_room_id(ob);
        room_info = ([
            "name"    : remove_ansi(ob->query("short") || ob->query("name") || ""),
            "exits"   : keys(ob->query("exits") || ([])),
            "area"    : ob->query("outdoors") || explode(base_name(ob), "/")[1],
            "room_id" : room_id,
            // 兼容已经读取 hash 字段的客户端；值不再依赖 crypto efun。
            "hash"    : room_id,
        ]);
        sendGMCP(room_info, "Room", "Info");
        // 音效示例
        if (room_info["name"] == "树林")
        {
            msp_oob("!!SOUND(10001.wav L=1 V=100 U=https://mud.ren/storage/wav/)");
        }
        else
        {
            msp_oob("!!SOUND(Off)");
        }
    }
    else if (package == "Char.Inventory.Get")
    {
        gmcp_refresh_items(1);
    }
    else if (package == "Char.Equipment.Get")
    {
        gmcp_refresh_items(1);
    }
}
