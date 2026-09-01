#include <ansi.h>
#include <skill.h>

private int do_exert(object me, string arg, object forced_target);
private int exert_preflight(object me);
private int safe_exert_token(string value);

int main(object me, string arg)
{
    seteuid(getuid());

    if (me->is_busy())
        return notify_fail("( 你上一个动作还没有完成，不能施用内功。)\n");

    if (!arg)
        return notify_fail("你要用内功做什么？\n");

    if (!exert_preflight(me))
        return 0;

    return do_exert(me, arg, 0);
}

private int exert_preflight(object me)
{
    if (!objectp(me) || me->is_busy())
        return notify_fail("( 你上一个动作还没有完成，不能施用内功。)\n");

    if (me->query_temp("no_exert") || me->query_condition("exert_drug"))
        return notify_fail(HIR "你只觉得内息一阵紊乱，根本无法控制内息。\n" NOR);
    return 1;
}

private int safe_exert_token(string value)
{
    int i;

    if (!stringp(value) || value == "" || strlen(value) > 64)
        return 0;
    for (i = 0; i < strlen(value); i++)
    {
        if ((value[i] >= 'a' && value[i] <= 'z') ||
            (value[i] >= '0' && value[i] <= '9') ||
            value[i] == '-' || value[i] == '_')
            continue;
        return 0;
    }
    return 1;
}

private int do_exert(object me, string arg, object forced_target)
{
    string force;

    if (stringp(force = me->query_skill_mapped("force")))
    {
        notify_fail("你无法顺利的运转内息。\n");

        if (SKILL_D(force)->do_effect(me))
            return 0;

        notify_fail("你所学的内功中没有这种功能。\n");
        if (SKILL_D(force)->exert_function(me, arg, forced_target))
        {
            if (random(120) < (int)me->query_skill("force"))
                me->improve_skill(force, 1, 1);
            return 1;
        }
        else if (SKILL_D("force")->exert_function(me, arg, forced_target))
        {
            if (random(120) < (int)me->query_skill("force", 1))
                me->improve_skill("force", 1, 1);
            return 1;
        }
        return 0;
    }

    return notify_fail("你请先用 enable 指令选择你要使用的内功。\n");
}

// Web GMCP entry: the caller supplies an already validated room object.
// All force/action checks remain in this command and the original exert file.
int do_exert_target(object me, string action, object target)
{
    seteuid(getuid());
    if (!objectp(me) || !safe_exert_token(action) ||
        (objectp(target) && (target == me || environment(target) != environment(me) ||
                             !target->is_character())))
        return 0;
    if (!exert_preflight(me))
        return 0;
    return do_exert(me, action, target);
}

int help (object me)
{
    write(@HELP
指令格式：exert|yun <功能名称> [<施用对象>]

用内力进行一些特异功能，你必需要指定<功能名称>，<施用对象>则可有可无。
在你使用某一种内功的特异功能之前，你必须先用 enable 指令来指定你要使用
的内功。

请参考 help force 可得知一些大部分内功都有的功能，至于你所用的内功到底
有没有该功能，试一试或参考其他说明便知。

注：如果你改变自己的内功，你原本蓄积的内力并不能直接转换过去，必须
    从０开始。

HELP );
    return 1;
}
