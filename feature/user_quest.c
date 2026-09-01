inherit CORE_USER_QUEST;

private void notify_web_quest_changed()
{
    if (function_exists("gmcp_quests_changed", this_object()))
        this_object()->gmcp_quests_changed();
}

void setToDo(string quest_file)
{
    ::setToDo(quest_file);
    notify_web_quest_changed();
}

void setSolved(string quest_file)
{
    ::setSolved(quest_file);
    notify_web_quest_changed();
}

void addKilled(string quest_file, string killed_file, int amount)
{
    ::addKilled(quest_file, killed_file, amount);
    notify_web_quest_changed();
}

void addItem(string quest_file, string item_file, int amount)
{
    ::addItem(quest_file, item_file, amount);
    notify_web_quest_changed();
}

void delToDo(string quest_file)
{
    ::delToDo(quest_file);
    notify_web_quest_changed();
}

void delSolved(string quest_file)
{
    ::delSolved(quest_file);
    notify_web_quest_changed();
}
