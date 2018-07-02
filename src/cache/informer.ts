import {InMemoryStore, Store} from "./store";
import {MetadataObject} from "../types/meta";
import {IResourceClient} from "../resource";
import {LabelSelector} from "../label";
import {WatchEvent} from "../types/meta/v1";

const debug = require("debug")("kubernetes:informer");

export interface Controller {
    waitForInitialList(): Promise<void>;
    stop(): void;
}

export class Informer<R extends MetadataObject> {
    public readonly store: Store<R>;

    public constructor(private resource: IResourceClient<R, any, any>,
                       private labelSelector?: LabelSelector,
                       store?: Store<R>,
                       ) {
        this.store = store || new InMemoryStore();
    }

    public start(): Controller {
        const handler = (event: WatchEvent<R>) => {
            const {type, object} = event;

            switch (type) {
                case "ADDED":
                case "MODIFIED":
                    debug("added or updated object %o: %o", (object as any).kind, `${object.metadata.namespace}/${object.metadata.name}`);
                    this.store.store(object);
                    break;
                case "DELETED":
                    debug("removed object %o: %s", (object as any).kind, `${object.metadata.namespace}/${object.metadata.name}`);
                    this.store.pull(object);
                    break;
            }
        };

        const watchHandle = this.resource.listWatch(handler, undefined, {labelSelector: this.labelSelector});

        return {
            waitForInitialList: () => watchHandle.initialized,
            stop: watchHandle.stop,
        };
    }

}