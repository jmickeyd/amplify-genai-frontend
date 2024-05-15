import {
    IconFileCheck,
} from '@tabler/icons-react';
import React, {useContext, useEffect} from "react";
import JSON5 from "json5";
import HomeContext from "@/pages/api/home/home.context";
import {useSendService} from "@/hooks/useChatSendService";
import {Conversation, Message, newMessage} from "@/types/chat";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {execOp} from "@/services/opsService";

interface Props {
    conversation: Conversation;
    message:Message;
    onStart: (id: string, action:any) => void;
    onEnd: (id: string, action:any) => void;
    action: any;
    ready: boolean;
    id: string;
    isLast: boolean;
}

const hasExecuted:{[key:string]:boolean} = {

}

const AutonomousBlock: React.FC<Props> = (
    {action, ready, id, isLast, onEnd, onStart, message, conversation}) => {

    const {
        state: {
            selectedConversation,
            selectedAssistant,
            conversations,
            folders,
            models,
            prompts,
            defaultModelId,
            featureFlags,
            workspaceMetadata
        },
        handleUpdateConversation,
        handleStopConversation,
        shouldStopConversation,
        handleCreateFolder,
        handleCustomLinkClick,
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);

    const {handleSend} = useSendService();

    function parseApiCall(str:string) {
        const functionName = str.split("(")[0];
        const paramsStr = str.substring(str.indexOf('(') + 1, str.lastIndexOf(')'));
        const params = JSON5.parse("["+paramsStr+"]");
        return { functionName, params };
    }

    const stripQuotes = (s:string) => {
        s = s.trim();

        if(s.startsWith('"') && s.endsWith('"')){
            return s.substring(1, s.length-1);
        }
        else if (s.startsWith("'") && s.endsWith("'")){
            return s.substring(1, s.length-1);
        }
        return s;
    }


    const handlers:{[key:string]:(params:any)=>any} = {
        "/ops": async (params:any) => {
            const tag = params[1];
            const result = await execOp("/ops/get", {
                tag
            });
            return result;
        },
        "/chats": (params:any) => {
            return conversations.map((c:any) => {
                return {
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                    workspaceId: c.workspaceId,
                    modelId: c.modelId,
                    folderId: c.folderId,
                }
            });
        },
        "/searchChats": (params:string[]) => {
            const thisId = selectedConversation?.id || "";
            params = params.slice(1);

            console.log('Searching for keywords', params);

            const results = conversations
                .filter((c) => c.id !== thisId)
                .filter((c) => {
                    const matches =  c.messages.filter((m) => {
                        return params.some((k: string) => m.content.includes(k));
                    });
                    return matches.length > 0;
                });

            return results.map((c:any) => {
                return {
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                    workspaceId: c.workspaceId,
                    modelId: c.modelId,
                    folderId: c.folderId,
                }
            });
        },
        "/chat": (params:any) => {
            console.log("/chat params:", params)

            const id = params[1];
            const chat = conversations.find((c:any) => c.id === id);

            if(!chat){
                return {error: "Conversation not found, try listing all of the chats to find a valid conversation id."};
            }

            console.log("chat:", chat);

            return chat;
        },
        "/chatSamples": (params:any) => {
            console.log("/chat params:", params)

            const ids = params.slice(1);
            const chats = conversations.filter((c:any) => ids.includes(c.id));

            if(chats.length === 0){
                return {error: "No conversations found for the given ids. Try listing the chats to find valid ids."};
            }

            const sampledMessagesPerChat = chats.map((c:any) => {
                const messages = c.messages;
                const sampledMessages = messages.slice(0, 6);
                return {
                    id: c.id,
                    name: c.name,
                    messages: sampledMessages
                }
            });

            return sampledMessagesPerChat;
        },
        "/folders": (params:any) => {
            return folders;
        },
        "/searchFolders": (params:string[]) => {
            params = params.slice(1);
            const found = folders.filter((f) => {
                return params.some((k: string) => f.name.includes(k));
            });

            if(found.length === 0){
                return {error: "No folders found with names that include the given keywords. Try listing all of the folders."};
            }

            return found;
        },
        "/models": (params:any) => {
            return models;
        },
        "/prompts": (params:any) => {
            return prompts;
        },
        "/defaultModelId": (params:any) => {
            return defaultModelId;
        },
        "/featureFlags": (params:any) => {
            return featureFlags;
        },
        "/workspaceMetadata": (params:any) => {
            return workspaceMetadata;
        },
        "/selectedConversation": (params:any) => {
            return selectedConversation;
        },
        "/selectedAssistant": (params:any) => {
            return selectedAssistant;
        },
        "/createChatFolder": (params:any) => {
            params = params.slice(1);
            const name = params[0];

            if(!name){
                return {error: "Folder name is required as a parameter"};
            }

            const folder = handleCreateFolder(name, "chat");
            return folder;
        },
        "/moveChatsToFolder": (params:any) => {
            params = params.slice(1);
            const folderId = params[0];
            const chatIds = params.slice(1);
            const folder = folders.find((f) => f.id === folderId);
            if(folder){
                const moved:{[key:string]:string} = {};
                for(const chatId of chatIds){
                    const chat = conversations.find((c) => c.id === chatId);
                    if(chat){
                        moved[chatId] = "Moved successfully.";
                        chat.folderId = folder.id;
                        homeDispatch({
                            type: 'conversation',
                            action: {
                                type: 'changeFolder',
                                conversationId: chat.id,
                                folderId: folder.id
                            }
                        })
                    }
                    else {
                        moved[chatId] = "Chat not found.";
                    }
                }

                return {success: true, resultByChatId: moved};
            }
            else {
                return {error: "Folder not found. Try listing the folders to find a valid folder id."};
            }
        },
    }

    const runAction = async (action: any) => {
        try{
            if(!isLast || hasExecuted[id] || message.data.automation){
               console.log("Skipping execution of action:", action,
                   "isLast:", isLast,
                   "hasExecuted:", hasExecuted[id],
                   "automation:", message.data.automation);
               return;
            }
            hasExecuted[id] = true;

            homeDispatch(
                {
                    type: 'conversation',
                    action: {
                        type: 'updateMessages',
                        conversationId: conversation.id,
                        messages: [{
                            ...message,
                            data: {
                                ...message.data,
                                automation: {
                                    status: "running"
                                }
                            }
                        }]
                    }
                }
            )

            const apiCall = parseApiCall(action);
            console.log("apiCall:", apiCall);

            const shouldConfirm = false;
            const { functionName, params } = apiCall;
            const url = stripQuotes(params[0]);

            const handler = handlers[url] || handlers["/"+url];

            let result = {success:false, message:"Unknown operation: "+url}
            if(handler){
                result = await handler(params);
            }

            if(!shouldStopConversation() && handleSend && (!shouldConfirm || confirm("Allow automation to proceed?"))){

                const feedbackMessage = {
                    op: action,
                    resultOfOp: result,
                }

                if(!shouldStopConversation()) {
                    handleSend(
                        {
                            message: newMessage(
                                {"role": "user", "content": JSON.stringify(feedbackMessage), label: "API Result"})
                        },
                        shouldStopConversation);
                }
            }
            // const handler = handlers[functionName];
            // if (handler) {
            //     handler(params).then((result: any) => {
            //         console.log("result:", result);
            //     });
            // }
            // else {
            //     console.error("No handler found for function:", functionName);
            // }
        }
        catch (e) {
            console.error(e);
            return null;
        }
    }

    useEffect(() => {
        if (ready) {
            runAction(action);
        }
    }, [ready, action]);

    return <div>
        <div
            className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2"
        >
            <ExpansionComponent title={"I am working on your request..."} content={action}/>
        </div>
    </div>;
};

export default AutonomousBlock;
